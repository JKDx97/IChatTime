import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Favorite } from './entities/favorite.entity';
import { Like } from '../likes/entities/like.entity';

@Injectable()
export class FavoritesService {
  constructor(
    @InjectRepository(Favorite) private readonly repo: Repository<Favorite>,
    @InjectRepository(Like) private readonly likes: Repository<Like>,
  ) {}

  async save(userId: string, postId: string) {
    const exists = await this.repo.findOne({ where: { userId, postId } });
    if (exists) return { ok: true, saved: true };
    await this.repo.save(this.repo.create({ userId, postId }));
    return { ok: true, saved: true };
  }

  async unsave(userId: string, postId: string) {
    await this.repo.delete({ userId, postId });
    return { ok: true, saved: false };
  }

  async isSaved(userId: string, postId: string) {
    const row = await this.repo.findOne({ where: { userId, postId } });
    return { saved: !!row };
  }

  async listByUser(userId: string, viewerId: string | null, limit = 20, cursor?: string) {
    const qb = this.repo
      .createQueryBuilder('f')
      .leftJoinAndSelect('f.post', 'p')
      .leftJoinAndSelect('p.user', 'u')
      .where('f.user_id = :userId', { userId })
      .orderBy('f.created_at', 'DESC')
      .limit(limit + 1);

    if (cursor) {
      try {
        const dec = JSON.parse(Buffer.from(cursor, 'base64').toString('utf8'));
        qb.andWhere('f.created_at < :cAt', { cAt: dec.createdAt });
      } catch { /* ignore */ }
    }

    const rows = await qb.getMany();
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const last = items[items.length - 1];
    const nextCursor =
      hasMore && last
        ? Buffer.from(JSON.stringify({ createdAt: last.createdAt.toISOString() })).toString('base64')
        : null;

    // Decorate posts with likedByMe + savedByMe
    const posts = items.map((f) => f.post).filter(Boolean);
    const decorated = await this.decoratePosts(posts, viewerId);
    return { items: decorated, nextCursor };
  }

  private async decoratePosts(posts: any[], viewerId: string | null) {
    if (posts.length === 0) return [];
    const ids = posts.map((p) => p.id);

    let likedSet = new Set<string>();
    let savedSet = new Set<string>();

    if (viewerId) {
      const [liked, saved] = await Promise.all([
        this.likes
          .createQueryBuilder('l')
          .select('l.post_id', 'postId')
          .where('l.user_id = :viewerId AND l.post_id IN (:...ids)', { viewerId, ids })
          .getRawMany<{ postId: string }>(),
        this.repo
          .createQueryBuilder('f')
          .select('f.post_id', 'postId')
          .where('f.user_id = :viewerId AND f.post_id IN (:...ids)', { viewerId, ids })
          .getRawMany<{ postId: string }>(),
      ]);
      likedSet = new Set(liked.map((x) => x.postId));
      savedSet = new Set(saved.map((x) => x.postId));
    }

    return posts.map((p) => ({
      ...p,
      likedByMe: likedSet.has(p.id),
      savedByMe: savedSet.has(p.id),
    }));
  }
}
