import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Story } from './entities/story.entity';
import { StoryView } from './entities/story-view.entity';
import { StoryLike } from './entities/story-like.entity';
import { NOTIF_EVENT, NotifEventPayload } from '../notifications/notifications.events';

@Injectable()
export class StoriesService {
  constructor(
    @InjectRepository(Story) private readonly repo: Repository<Story>,
    @InjectRepository(StoryView) private readonly views: Repository<StoryView>,
    @InjectRepository(StoryLike) private readonly likes: Repository<StoryLike>,
    private readonly events: EventEmitter2,
  ) {}

  async create(userId: string, mediaUrl: string, mediaType: 'image' | 'video') {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const story = this.repo.create({ userId, mediaUrl, mediaType, expiresAt });
    const saved = await this.repo.save(story);
    return this.repo.findOne({ where: { id: saved.id }, relations: ['user'] });
  }

  async remove(id: string, userId: string) {
    const story = await this.repo.findOne({ where: { id } });
    if (!story) throw new NotFoundException();
    if (story.userId !== userId) throw new ForbiddenException();
    await this.repo.delete(id);
    return { ok: true };
  }

  /** Get stories feed: grouped by user, only from people I follow + my own, not expired */
  async feed(viewerId: string) {
    const now = new Date();
    const stories = await this.repo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.user', 'u')
      .where('s.expires_at > :now', { now })
      .andWhere(
        `(s.user_id = :viewerId OR s.user_id IN (SELECT following_id FROM follows WHERE follower_id = :viewerId))`,
        { viewerId },
      )
      .orderBy('s.created_at', 'ASC')
      .getMany();

    // Get which stories the viewer has already seen
    const storyIds = stories.map((s) => s.id);
    let viewedSet = new Set<string>();
    if (storyIds.length > 0) {
      const viewed = await this.views
        .createQueryBuilder('v')
        .select('v.story_id', 'storyId')
        .where('v.user_id = :viewerId AND v.story_id IN (:...storyIds)', { viewerId, storyIds })
        .getRawMany<{ storyId: string }>();
      viewedSet = new Set(viewed.map((v) => v.storyId));
    }

    // Get liked stories
    let likedSet = new Set<string>();
    if (storyIds.length > 0) {
      const liked = await this.likes
        .createQueryBuilder('l')
        .select('l.story_id', 'storyId')
        .where('l.user_id = :viewerId AND l.story_id IN (:...storyIds)', { viewerId, storyIds })
        .getRawMany<{ storyId: string }>();
      likedSet = new Set(liked.map((l) => l.storyId));
    }

    // Group by user
    const grouped = new Map<string, { user: any; stories: any[]; hasUnviewed: boolean }>();
    for (const s of stories) {
      if (!grouped.has(s.userId)) {
        grouped.set(s.userId, { user: s.user, stories: [], hasUnviewed: false });
      }
      const g = grouped.get(s.userId)!;
      const viewed = viewedSet.has(s.id);
      g.stories.push({
        id: s.id,
        mediaUrl: s.mediaUrl,
        mediaType: s.mediaType,
        likesCount: s.likesCount,
        likedByMe: likedSet.has(s.id),
        viewed,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
      });
      if (!viewed) g.hasUnviewed = true;
    }

    // Sort: my stories first, then users with unviewed, then viewed
    const result = Array.from(grouped.values());
    result.sort((a, b) => {
      if (a.user.id === viewerId) return -1;
      if (b.user.id === viewerId) return 1;
      if (a.hasUnviewed && !b.hasUnviewed) return -1;
      if (!a.hasUnviewed && b.hasUnviewed) return 1;
      return 0;
    });

    return result;
  }

  async markViewed(storyId: string, userId: string) {
    try {
      await this.views.insert({ storyId, userId });
    } catch {
      // Already viewed, ignore unique constraint violation
    }
    return { ok: true };
  }

  async like(storyId: string, userId: string) {
    const story = await this.repo.findOne({ where: { id: storyId } });
    if (!story) throw new NotFoundException();
    let created = false;
    try {
      await this.likes.insert({ storyId, userId });
      await this.repo.increment({ id: storyId }, 'likesCount', 1);
      created = true;
    } catch {
      // Already liked
    }
    if (created) {
      this.events.emit(NOTIF_EVENT, <NotifEventPayload>{
        userId: story.userId,
        actorId: userId,
        type: 'story_like',
        entityId: storyId,
        entityType: 'story',
        entityMediaUrl: story.mediaUrl,
      });
    }
    return { ok: true, liked: true };
  }

  async unlike(storyId: string, userId: string) {
    const result = await this.likes.delete({ storyId, userId });
    if (result.affected && result.affected > 0) {
      await this.repo.decrement({ id: storyId }, 'likesCount', 1);
    }
    return { ok: true, liked: false };
  }

  /** Get viewers of a story (only the owner should call this) */
  async getViewers(storyId: string, ownerId: string) {
    const story = await this.repo.findOne({ where: { id: storyId } });
    if (!story) throw new NotFoundException();
    if (story.userId !== ownerId) throw new ForbiddenException();
    const rows: {
      id: string;
      username: string;
      display_name: string;
      avatar_url: string | null;
      viewed_at: string;
    }[] = await this.views.query(
      `SELECT u.id, u.username, u.display_name, u.avatar_url, sv.created_at AS viewed_at
       FROM story_views sv
       JOIN users u ON u.id = sv.user_id
       WHERE sv.story_id = $1 AND sv.user_id != $2
       ORDER BY sv.created_at DESC`,
      [storyId, ownerId],
    );
    return rows.map((r) => ({
      id: r.id,
      username: r.username,
      displayName: r.display_name,
      avatarUrl: r.avatar_url,
      viewedAt: r.viewed_at,
    }));
  }

  /** Get a single story by id (for chat reply context) */
  async findById(id: string) {
    return this.repo.findOne({ where: { id }, relations: ['user'] });
  }
}
