import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import { Flash } from './entities/flash.entity';
import { FlashLike } from './entities/flash-like.entity';
import { FlashComment } from './entities/flash-comment.entity';

interface PageCursor {
  createdAt: string;
  id: string;
}

@Injectable()
export class FlashesService {
  constructor(
    @InjectRepository(Flash) private readonly repo: Repository<Flash>,
    @InjectRepository(FlashLike) private readonly likeRepo: Repository<FlashLike>,
    @InjectRepository(FlashComment) private readonly commentRepo: Repository<FlashComment>,
    private readonly ds: DataSource,
  ) {}

  /* ─── CRUD ─────────────────────────────── */

  async create(userId: string, videoUrl: string, description: string) {
    const flash = this.repo.create({ userId, videoUrl, description: description ?? '' });
    const saved = await this.repo.save(flash);
    return this.repo.findOneOrFail({ where: { id: saved.id }, relations: ['user'] });
  }

  async remove(id: string, userId: string) {
    const f = await this.repo.findOne({ where: { id } });
    if (!f) throw new NotFoundException();
    if (f.userId !== userId) throw new ForbiddenException();
    await this.repo.delete(id);
    return { ok: true };
  }

  /* ─── FEEDS ────────────────────────────── */

  async feed(viewerId: string, limit = 10, cursor?: string) {
    const qb = this.repo
      .createQueryBuilder('f')
      .leftJoinAndSelect('f.user', 'u')
      .orderBy('f.created_at', 'DESC')
      .addOrderBy('f.id', 'DESC')
      .limit(limit + 1);
    this.applyCursor(qb, cursor);
    const rows = await qb.getMany();
    return this.paginate(rows, limit, viewerId);
  }

  async randomFeed(viewerId: string, limit = 10, offset = 0) {
    const rows = await this.repo
      .createQueryBuilder('f')
      .leftJoinAndSelect('f.user', 'u')
      .orderBy('RANDOM()')
      .offset(offset)
      .limit(limit)
      .getMany();
    const decorated = await this.decorate(rows, viewerId);
    return { items: decorated, hasMore: rows.length === limit };
  }

  async byUser(userId: string, viewerId: string | null, limit = 10, cursor?: string) {
    const qb = this.repo
      .createQueryBuilder('f')
      .leftJoinAndSelect('f.user', 'u')
      .where('f.user_id = :userId', { userId })
      .orderBy('f.created_at', 'DESC')
      .addOrderBy('f.id', 'DESC')
      .limit(limit + 1);
    this.applyCursor(qb, cursor);
    const rows = await qb.getMany();
    return this.paginate(rows, limit, viewerId);
  }

  async findById(id: string, viewerId?: string | null) {
    const f = await this.repo.findOne({ where: { id }, relations: ['user'] });
    if (!f) throw new NotFoundException('Flash not found');
    const decorated = await this.decorate([f], viewerId ?? null);
    return decorated[0];
  }

  /* ─── LIKES ────────────────────────────── */

  async like(userId: string, flashId: string) {
    return this.ds.transaction(async (m) => {
      const flash = await m.findOne(Flash, { where: { id: flashId } });
      if (!flash) throw new NotFoundException();
      const existing = await m.findOne(FlashLike, { where: { userId, flashId } });
      if (existing) return { ok: true, liked: true };
      await m.insert(FlashLike, { userId, flashId });
      await m.increment(Flash, { id: flashId }, 'likesCount', 1);
      return { ok: true, liked: true };
    });
  }

  async unlike(userId: string, flashId: string) {
    return this.ds.transaction(async (m) => {
      const res = await m.delete(FlashLike, { userId, flashId });
      if (res.affected) {
        await m.decrement(Flash, { id: flashId }, 'likesCount', 1);
      }
      return { ok: true, liked: false };
    });
  }

  /* ─── COMMENTS ─────────────────────────── */

  async createComment(
    userId: string,
    flashId: string,
    content?: string,
    parentId?: string,
    mediaUrls?: string[],
  ) {
    return this.ds.transaction(async (m) => {
      const flash = await m.findOne(Flash, { where: { id: flashId } });
      if (!flash) throw new NotFoundException();

      if (parentId) {
        const parent = await m.findOne(FlashComment, { where: { id: parentId, flashId } });
        if (!parent) throw new NotFoundException('Parent comment not found');
      }

      const saved = await m.save(
        m.create(FlashComment, {
          userId,
          flashId,
          content: content || null,
          parentId: parentId || null,
          mediaUrls: mediaUrls ?? [],
        }),
      );

      if (parentId) {
        await m.increment(FlashComment, { id: parentId }, 'repliesCount', 1);
      }

      await m.increment(Flash, { id: flashId }, 'commentsCount', 1);
      const c = await m.findOne(FlashComment, { where: { id: saved.id }, relations: ['user'] });
      return c!;
    });
  }

  async listComments(flashId: string, limit = 30, cursor?: string) {
    const qb = this.commentRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.user', 'u')
      .where('c.flash_id = :flashId', { flashId })
      .andWhere('c.parent_id IS NULL')
      .orderBy('c.created_at', 'ASC')
      .addOrderBy('c.id', 'ASC')
      .limit(limit + 1);
    if (cursor) {
      try {
        const dec = JSON.parse(Buffer.from(cursor, 'base64').toString('utf8'));
        qb.andWhere('(c.created_at, c.id) > (:a, :b)', { a: dec.createdAt, b: dec.id });
      } catch { /* ignore */ }
    }
    const rows = await qb.getMany();
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const last = items[items.length - 1];
    const nextCursor =
      hasMore && last
        ? Buffer.from(JSON.stringify({ createdAt: last.createdAt.toISOString(), id: last.id })).toString('base64')
        : null;
    return { items, nextCursor };
  }

  async listCommentReplies(commentId: string, limit = 30, cursor?: string) {
    const qb = this.commentRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.user', 'u')
      .where('c.parent_id = :commentId', { commentId })
      .orderBy('c.created_at', 'ASC')
      .addOrderBy('c.id', 'ASC')
      .limit(limit + 1);
    if (cursor) {
      try {
        const dec = JSON.parse(Buffer.from(cursor, 'base64').toString('utf8'));
        qb.andWhere('(c.created_at, c.id) > (:a, :b)', { a: dec.createdAt, b: dec.id });
      } catch { /* ignore */ }
    }
    const rows = await qb.getMany();
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const last = items[items.length - 1];
    const nextCursor =
      hasMore && last
        ? Buffer.from(JSON.stringify({ createdAt: last.createdAt.toISOString(), id: last.id })).toString('base64')
        : null;
    return { items, nextCursor };
  }

  async removeComment(id: string, userId: string) {
    const c = await this.commentRepo.findOne({ where: { id } });
    if (!c) throw new NotFoundException();

    // Allowed: comment author, parent-comment author, or flash owner
    let allowed = c.userId === userId;
    if (!allowed && c.parentId) {
      const parent = await this.commentRepo.findOne({ where: { id: c.parentId } });
      if (parent && parent.userId === userId) allowed = true;
    }
    if (!allowed) {
      const flash = await this.repo.findOne({ where: { id: c.flashId } });
      if (flash && flash.userId === userId) allowed = true;
    }
    if (!allowed) throw new ForbiddenException();

    return this.ds.transaction(async (m) => {
      const nestedCount = await m.count(FlashComment, { where: { parentId: id } });
      const totalRemoved = 1 + nestedCount;

      await m.delete(FlashComment, id);
      await m.decrement(Flash, { id: c.flashId }, 'commentsCount', totalRemoved);
      if (c.parentId) {
        await m.decrement(FlashComment, { id: c.parentId }, 'repliesCount', 1);
      }
      return { ok: true, removed: totalRemoved };
    });
  }

  /* ─── HELPERS ──────────────────────────── */

  private applyCursor(qb: SelectQueryBuilder<Flash>, cursor?: string) {
    if (!cursor) return;
    try {
      const c: PageCursor = JSON.parse(Buffer.from(cursor, 'base64').toString('utf8'));
      qb.andWhere('(f.created_at, f.id) < (:cAt, :cId)', { cAt: c.createdAt, cId: c.id });
    } catch { /* ignore */ }
  }

  private async paginate(rows: Flash[], limit: number, viewerId: string | null) {
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const last = items[items.length - 1];
    const nextCursor =
      hasMore && last
        ? Buffer.from(JSON.stringify({ createdAt: last.createdAt.toISOString(), id: last.id })).toString('base64')
        : null;
    return { items: await this.decorate(items, viewerId), nextCursor };
  }

  private async decorate(items: Flash[], viewerId: string | null) {
    if (!viewerId || items.length === 0) {
      return items.map((f) => ({ ...f, likedByMe: false }));
    }
    const ids = items.map((f) => f.id);
    const liked = await this.likeRepo
      .createQueryBuilder('l')
      .select('l.flash_id', 'flashId')
      .where('l.user_id = :viewerId AND l.flash_id IN (:...ids)', { viewerId, ids })
      .getRawMany<{ flashId: string }>();
    const set = new Set(liked.map((x) => x.flashId));
    return items.map((f) => ({ ...f, likedByMe: set.has(f.id) }));
  }
}
