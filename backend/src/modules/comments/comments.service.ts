import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Comment } from './entities/comment.entity';
import { Post } from '../posts/entities/post.entity';
import {
  NOTIF_EVENT,
  NotifEventPayload,
} from '../notifications/notifications.events';

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(Comment) private readonly repo: Repository<Comment>,
    private readonly ds: DataSource,
    private readonly events: EventEmitter2,
  ) {}

  create(
    userId: string,
    postId: string,
    content?: string,
    parentId?: string,
    mediaUrls?: string[],
  ) {
    return this.ds.transaction(async (m) => {
      const post = await m.findOne(Post, { where: { id: postId } });
      if (!post) throw new NotFoundException('Post not found');

      if (parentId) {
        const parent = await m.findOne(Comment, { where: { id: parentId, postId } });
        if (!parent) throw new NotFoundException('Parent comment not found');
      }

      const saved = await m.save(
        m.create(Comment, {
          userId,
          postId,
          content: content || null,
          parentId: parentId || null,
          mediaUrls: mediaUrls ?? [],
        }),
      );

      if (parentId) {
        await m.increment(Comment, { id: parentId }, 'repliesCount', 1);
      }

      await m.increment(Post, { id: postId }, 'commentsCount', 1);

      const c = await m.findOne(Comment, {
        where: { id: saved.id },
        relations: ['user'],
      });

      // Notify post owner about the comment
      this.events.emit(NOTIF_EVENT, <NotifEventPayload>{
        userId: post.userId,
        actorId: userId,
        type: 'comment',
        entityId: postId,
        entityType: 'post',
        entityMediaUrl: post.mediaUrls?.[0] ?? null,
      });

      // Notify parent comment author about the reply
      if (parentId) {
        const parent = await m.findOne(Comment, { where: { id: parentId } });
        if (parent && parent.userId !== userId && parent.userId !== post.userId) {
          this.events.emit(NOTIF_EVENT, <NotifEventPayload>{
            userId: parent.userId,
            actorId: userId,
            type: 'comment_reply',
            entityId: postId,
            entityType: 'post',
            entityMediaUrl: post.mediaUrls?.[0] ?? null,
          });
        }
      }

      return c!;
    });
  }

  async listByPost(postId: string, limit = 30, cursor?: string) {
    const qb = this.repo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.user', 'u')
      .where('c.post_id = :postId', { postId })
      .andWhere('c.parent_id IS NULL')
      .orderBy('c.created_at', 'ASC')
      .addOrderBy('c.id', 'ASC')
      .limit(limit + 1);
    if (cursor) {
      try {
        const dec = JSON.parse(Buffer.from(cursor, 'base64').toString('utf8'));
        qb.andWhere('(c.created_at, c.id) > (:a, :b)', {
          a: dec.createdAt,
          b: dec.id,
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

  async listReplies(commentId: string, limit = 30, cursor?: string) {
    const qb = this.repo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.user', 'u')
      .where('c.parent_id = :commentId', { commentId })
      .orderBy('c.created_at', 'ASC')
      .addOrderBy('c.id', 'ASC')
      .limit(limit + 1);
    if (cursor) {
      try {
        const dec = JSON.parse(Buffer.from(cursor, 'base64').toString('utf8'));
        qb.andWhere('(c.created_at, c.id) > (:a, :b)', {
          a: dec.createdAt,
          b: dec.id,
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

  async remove(id: string, userId: string) {
    const c = await this.repo.findOne({ where: { id } });
    if (!c) throw new NotFoundException();

    // Allowed: comment author, parent-comment author, or post owner
    let allowed = c.userId === userId;
    if (!allowed && c.parentId) {
      const parent = await this.repo.findOne({ where: { id: c.parentId } });
      if (parent && parent.userId === userId) allowed = true;
    }
    if (!allowed) {
      const post = await this.ds.getRepository(Post).findOne({ where: { id: c.postId } });
      if (post && post.userId === userId) allowed = true;
    }
    if (!allowed) throw new ForbiddenException();

    return this.ds.transaction(async (m) => {
      // Count nested replies for commentsCount adjustment
      const nestedCount = await m.count(Comment, { where: { parentId: id } });
      const totalRemoved = 1 + nestedCount;

      // Delete the comment (cascades to replies via onDelete: CASCADE)
      await m.delete(Comment, id);
      await m.decrement(Post, { id: c.postId }, 'commentsCount', totalRemoved);
      if (c.parentId) {
        await m.decrement(Comment, { id: c.parentId }, 'repliesCount', 1);
      }
      return { ok: true, removed: totalRemoved };
    });
  }
}
