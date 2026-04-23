import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

@Entity('story_views')
@Unique(['storyId', 'userId'])
@Index(['userId'])
export class StoryView {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'story_id' })
  storyId: string;

  @Column({ name: 'user_id' })
  userId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
