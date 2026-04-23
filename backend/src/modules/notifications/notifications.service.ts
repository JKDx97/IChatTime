import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly repo: Repository<Notification>,
  ) {}

  create(data: Partial<Notification>) {
    return this.repo.save(this.repo.create(data));
  }

  async list(userId: string, limit = 30, cursor?: string) {
    const qb = this.repo
      .createQueryBuilder('n')
      .leftJoinAndSelect('n.actor', 'actor')
      .where('n.user_id = :userId', { userId })
      .orderBy('n.created_at', 'DESC')
      .addOrderBy('n.id', 'DESC')
      .limit(limit + 1);
    if (cursor) {
      try {
        const c = JSON.parse(Buffer.from(cursor, 'base64').toString('utf8'));
        qb.andWhere('(n.created_at, n.id) < (:a, :b)', {
          a: c.createdAt,
          b: c.id,
        });
      } catch {
        /* ignore */
      }
    }
    const rows = await qb.getMany();
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
    return { items, nextCursor };
  }

  unreadCount(userId: string) {
    return this.repo.count({ where: { userId, readAt: IsNull() } });
  }

  async markAllRead(userId: string) {
    await this.repo
      .createQueryBuilder()
      .update(Notification)
      .set({ readAt: new Date() })
      .where('user_id = :userId AND read_at IS NULL', { userId })
      .execute();
    return { ok: true };
  }

  async deleteOne(userId: string, notifId: string) {
    await this.repo.delete({ id: notifId, userId });
    return { ok: true };
  }

  async deleteAll(userId: string) {
    await this.repo.delete({ userId });
    return { ok: true };
  }
}
