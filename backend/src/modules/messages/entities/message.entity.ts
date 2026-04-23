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

@Entity('messages')
@Index('IDX_msg_sender_receiver_created', ['senderId', 'receiverId', 'createdAt'])
@Index('IDX_msg_receiver_sender_created', ['receiverId', 'senderId', 'createdAt'])
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'sender_id' })
  senderId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', eager: true })
  @JoinColumn({ name: 'sender_id' })
  sender: User;

  @Column({ name: 'receiver_id' })
  receiverId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', eager: true })
  @JoinColumn({ name: 'receiver_id' })
  receiver: User;

  @Column({ type: 'text', nullable: true })
  content: string | null;

  @Column({ name: 'media_urls', type: 'jsonb', default: '[]' })
  mediaUrls: string[];

  @Column({ name: 'story_id', type: 'uuid', nullable: true })
  storyId: string | null;

  @Column({ name: 'story_media_url', type: 'text', nullable: true })
  storyMediaUrl: string | null;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt: Date | null;

  @Column({ name: 'deleted_for_all', default: false })
  deletedForAll: boolean;

  @Column({ name: 'deleted_for', type: 'jsonb', default: '[]' })
  deletedFor: string[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
