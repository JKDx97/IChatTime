import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export type NotificationType = 'like' | 'comment' | 'comment_reply' | 'follow' | 'story_like' | 'friend_request' | 'friend_accept';

@Entity('notifications')
@Index(['userId', 'createdAt'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'actor_id' })
  actorId: string;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'actor_id' })
  actor: User;

  @Column({ type: 'varchar', length: 20 })
  type: NotificationType;

  @Column({ type: 'text', default: '' })
  message: string;

  @Column({ name: 'entity_id', type: 'uuid', nullable: true })
  entityId: string | null;

  @Column({ name: 'entity_type', type: 'varchar', length: 20, nullable: true })
  entityType: string | null;

  @Column({ name: 'entity_media_url', type: 'text', nullable: true })
  entityMediaUrl: string | null;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
