import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Like } from './entities/like.entity';
import { Post } from '../posts/entities/post.entity';
import {
  NOTIF_EVENT,
  NotifEventPayload,
} from '../notifications/notifications.events';

@Injectable()
export class LikesService {
  constructor(
    @InjectRepository(Like) private readonly likes: Repository<Like>,
    @InjectRepository(Post) private readonly posts: Repository<Post>,
    private readonly ds: DataSource,
    private readonly events: EventEmitter2,
  ) {}

  async like(userId: string, postId: string) {
    const result = await this.ds.transaction(async (m) => {
      const post = await m.findOne(Post, { where: { id: postId } });
      if (!post) throw new NotFoundException('Post not found');
      const existing = await m.findOne(Like, { where: { userId, postId } });
      if (existing) return { post, created: false };
      await m.insert(Like, { userId, postId });
      await m.increment(Post, { id: postId }, 'likesCount', 1);
      return { post, created: true };
    });
    if (result.created) {
      this.events.emit(NOTIF_EVENT, <NotifEventPayload>{
        userId: result.post.userId,
        actorId: userId,
        type: 'like',
        entityId: postId,
        entityType: 'post',
        entityMediaUrl: result.post.mediaUrls?.[0] ?? null,
      });
    }
    return { ok: true, liked: true };
  }

  async unlike(userId: string, postId: string) {
    return this.ds.transaction(async (m) => {
      const res = await m.delete(Like, { userId, postId });
      if (res.affected) {
        await m.decrement(Post, { id: postId }, 'likesCount', 1);
      }
      return { ok: true, liked: false };
    });
  }
}
