import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Post } from '../posts/entities/post.entity';
import { Flash } from '../flashes/entities/flash.entity';

export interface TrendItem {
  tag: string;
  count: number;
}

@Injectable()
export class ExploreService {
  constructor(
    @InjectRepository(Post) private readonly posts: Repository<Post>,
    @InjectRepository(Flash) private readonly flashes: Repository<Flash>,
  ) {}

  /** Extract top trending hashtags from posts + flashes created today */
  async trending(limit = 15): Promise<TrendItem[]> {
    const since = new Date();
    since.setHours(0, 0, 0, 0);

    // Extract hashtags from posts
    const postTags: { tag: string }[] = await this.posts
      .createQueryBuilder('p')
      .select("LOWER(unnest(regexp_matches(p.content, '#[a-zA-Z0-9_áéíóúñÁÉÍÓÚÑ]+', 'g')))", 'tag')
      .where('p.created_at >= :since', { since: since.toISOString() })
      .andWhere("p.content ~ '#[a-zA-Z0-9_]+'")
      .getRawMany();

    // Extract hashtags from flashes
    const flashTags: { tag: string }[] = await this.flashes
      .createQueryBuilder('f')
      .select("LOWER(unnest(regexp_matches(f.description, '#[a-zA-Z0-9_áéíóúñÁÉÍÓÚÑ]+', 'g')))", 'tag')
      .where('f.created_at >= :since', { since: since.toISOString() })
      .andWhere("f.description ~ '#[a-zA-Z0-9_]+'")
      .getRawMany();

    // Merge and count
    const counts = new Map<string, number>();
    for (const { tag } of [...postTags, ...flashTags]) {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }

    return Array.from(counts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /** Search posts/flashes/notes that contain a word or hashtag */
  async searchByTag(
    tag: string,
    viewerId: string | null,
    limit = 20,
  ): Promise<{ posts: any[]; flashes: any[]; notes: any[] }> {
    const pattern = `%${tag}%`;

    // Posts with media
    const postsWithMedia = await this.posts
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.user', 'u')
      .where('LOWER(p.content) LIKE LOWER(:pattern)', { pattern })
      .andWhere("p.media_urls != '[]'::jsonb")
      .orderBy('p.created_at', 'DESC')
      .limit(limit)
      .getMany();

    // Notes (text-only)
    const notes = await this.posts
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.user', 'u')
      .where('LOWER(p.content) LIKE LOWER(:pattern)', { pattern })
      .andWhere("p.media_urls = '[]'::jsonb")
      .orderBy('p.created_at', 'DESC')
      .limit(limit)
      .getMany();

    // Flashes
    const flashes = await this.flashes
      .createQueryBuilder('f')
      .leftJoinAndSelect('f.user', 'u')
      .where('LOWER(f.description) LIKE LOWER(:pattern)', { pattern })
      .orderBy('f.created_at', 'DESC')
      .limit(limit)
      .getMany();

    return {
      posts: postsWithMedia,
      flashes,
      notes,
    };
  }

  /** Get random flashes for explore grid */
  async exploreFlashes(limit = 9) {
    return this.flashes
      .createQueryBuilder('f')
      .leftJoinAndSelect('f.user', 'u')
      .orderBy('RANDOM()')
      .limit(limit)
      .getMany();
  }
}
