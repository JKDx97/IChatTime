import { CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('follows')
@Index(['followingId', 'followerId'])
export class Follow {
  @PrimaryColumn({ name: 'follower_id', type: 'uuid' })
  followerId: string;

  @PrimaryColumn({ name: 'following_id', type: 'uuid' })
  followingId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
