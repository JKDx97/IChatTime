import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Follow } from './entities/follow.entity';
import { User } from '../users/entities/user.entity';
import { Post } from '../posts/entities/post.entity';
import {
  NOTIF_EVENT,
  NotifEventPayload,
} from '../notifications/notifications.events';

@Injectable()
export class FollowsService {
  constructor(
    @InjectRepository(Follow) private readonly repo: Repository<Follow>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Post) private readonly posts: Repository<Post>,
    private readonly events: EventEmitter2,
  ) {}

  async follow(followerId: string, followingId: string) {
    if (followerId === followingId) {
      throw new BadRequestException('No puedes seguirte a ti mismo');
    }
    const target = await this.users.findOne({ where: { id: followingId } });
    if (!target) throw new NotFoundException('User not found');
    const existing = await this.repo.findOne({
      where: { followerId, followingId },
    });
    if (existing) return { ok: true, following: true };
    await this.repo.insert({ followerId, followingId });
    this.events.emit(NOTIF_EVENT, <NotifEventPayload>{
      userId: followingId,
      actorId: followerId,
      type: 'follow',
      entityId: null,
    });
    return { ok: true, following: true };
  }

  async unfollow(followerId: string, followingId: string) {
    await this.repo.delete({ followerId, followingId });
    return { ok: true, following: false };
  }

  async stats(userId: string, viewerId?: string | null) {
    const [followers, following, postsCount] = await Promise.all([
      this.repo.count({ where: { followingId: userId } }),
      this.repo.count({ where: { followerId: userId } }),
      this.posts.count({ where: { userId } }),
    ]);
    let followedByMe = false;
    if (viewerId && viewerId !== userId) {
      followedByMe = !!(await this.repo.findOne({
        where: { followerId: viewerId, followingId: userId },
      }));
    }
    return { followers, following, followedByMe, postsCount };
  }

  listFollowers(userId: string) {
    return this.repo
      .createQueryBuilder('f')
      .innerJoin(User, 'u', 'u.id = f.follower_id')
      .where('f.following_id = :userId', { userId })
      .select([
        'u.id AS id',
        'u.username AS username',
        'u.display_name AS "displayName"',
        'u.avatar_url AS "avatarUrl"',
      ])
      .orderBy('f.created_at', 'DESC')
      .getRawMany();
  }

  listFollowing(userId: string) {
    return this.repo
      .createQueryBuilder('f')
      .innerJoin(User, 'u', 'u.id = f.following_id')
      .where('f.follower_id = :userId', { userId })
      .select([
        'u.id AS id',
        'u.username AS username',
        'u.display_name AS "displayName"',
        'u.avatar_url AS "avatarUrl"',
      ])
      .orderBy('f.created_at', 'DESC')
      .getRawMany();
  }
}
