import { CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('likes')
@Index(['postId'])
export class Like {
  @PrimaryColumn({ name: 'user_id' })
  userId: string;

  @PrimaryColumn({ name: 'post_id' })
  postId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
