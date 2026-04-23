import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Post } from './entities/post.entity';
import { CreatePostDto } from './dto/create-post.dto';
import { Like } from '../likes/entities/like.entity';
import { Favorite } from '../favorites/entities/favorite.entity';

export interface PageCursor {
  createdAt: string;
  id: string;
}

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post) private readonly repo: Repository<Post>,
    @InjectRepository(Like) private readonly likes: Repository<Like>,
    @InjectRepository(Favorite) private readonly favs: Repository<Favorite>,
  ) {}

  create(userId: string, dto: CreatePostDto, mediaUrls: string[]) {
    return this.repo.save(
      this.repo.create({
        userId,
        content: dto.content ?? '',
        mediaUrls,
      }),
    );
  }

  async findById(id: string, viewerId?: string | null) {
    const post = await this.repo.findOne({
      where: { id },
      relations: ['user'],
    });
    if (!post) throw new NotFoundException('Post not found');
    const decorated = await this.decorate([post], viewerId ?? null);
    return decorated[0];
  }

  async remove(id: string, userId: string) {
    const post = await this.repo.findOne({ where: { id } });
    if (!post) throw new NotFoundException();
    if (post.userId !== userId) throw new ForbiddenException();
    await this.repo.delete(id);
    return { ok: true };
  }

  async listByUser(
    userId: string,
    viewerId: string | null,
    limit = 20,
    cursor?: string,
    textOnly?: boolean,
    withMedia?: boolean,
  ) {
    const qb = this.repo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.user', 'u')
      .where('p.user_id = :userId', { userId })
      .orderBy('p.created_at', 'DESC')
      .addOrderBy('p.id', 'DESC')
      .limit(limit + 1);
    if (textOnly) {
      qb.andWhere("p.media_urls = '[]'::jsonb");
    }
    if (withMedia) {
      qb.andWhere("p.media_urls != '[]'::jsonb");
    }
    this.applyCursor(qb, cursor);
    const rows = await qb.getMany();
    return this.paginate(rows, limit, viewerId);
  }

  async listFeed(viewerId: string, limit = 20, cursor?: string) {
    const qb = this.repo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.user', 'u')
      .where(
        `p.user_id = :viewerId
         OR p.user_id IN (SELECT following_id FROM follows WHERE follower_id = :viewerId)`,
        { viewerId },
      )
      .orderBy('p.created_at', 'DESC')
      .addOrderBy('p.id', 'DESC')
      .limit(limit + 1);
    this.applyCursor(qb, cursor);
    const rows = await qb.getMany();
    return this.paginate(rows, limit, viewerId);
  }

  private applyCursor(qb: SelectQueryBuilder<Post>, cursor?: string) {
    if (!cursor) return;
    try {
      const c: PageCursor = JSON.parse(
        Buffer.from(cursor, 'base64').toString('utf8'),
      );
      qb.andWhere('(p.created_at, p.id) < (:cAt, :cId)', {
        cAt: c.createdAt,
        cId: c.id,
      });
    } catch {
      /* cursor inválido se ignora */
    }
  }

  private async paginate(
    rows: Post[],
    limit: number,
    viewerId: string | null,
  ) {
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const last = items[items.length - 1];
    const nextCursor =
      hasMore && last
        ? Buffer.from(
            JSON.stringify({
              createdAt: last.createdAt.toISOString(),
              id: last.id,
            }),
          ).toString('base64')
        : null;
    return { items: await this.decorate(items, viewerId), nextCursor };
  }

  private async decorate(items: Post[], viewerId: string | null) {
    if (!viewerId || items.length === 0) {
      return items.map((p) => ({ ...p, likedByMe: false, savedByMe: false }));
    }
    const ids = items.map((p) => p.id);
    const [liked, saved] = await Promise.all([
      this.likes
        .createQueryBuilder('l')
        .select('l.post_id', 'postId')
        .where('l.user_id = :viewerId AND l.post_id IN (:...ids)', { viewerId, ids })
        .getRawMany<{ postId: string }>(),
      this.favs
        .createQueryBuilder('f')
        .select('f.post_id', 'postId')
        .where('f.user_id = :viewerId AND f.post_id IN (:...ids)', { viewerId, ids })
        .getRawMany<{ postId: string }>(),
    ]);
    const likedSet = new Set(liked.map((x) => x.postId));
    const savedSet = new Set(saved.map((x) => x.postId));
    return items.map((p) => ({ ...p, likedByMe: likedSet.has(p.id), savedByMe: savedSet.has(p.id) }));
  }
}
