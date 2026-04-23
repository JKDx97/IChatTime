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

@Entity('stories')
@Index(['expiresAt'])
@Index(['userId', 'createdAt'])
export class Story {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'media_url', type: 'text' })
  mediaUrl: string;

  @Column({ name: 'media_type', type: 'varchar', length: 10, default: 'image' })
  mediaType: 'image' | 'video';

  @Column({ type: 'int', default: 0, name: 'likes_count' })
  likesCount: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;
}
