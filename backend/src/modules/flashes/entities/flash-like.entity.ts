import { CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('flash_likes')
@Index(['flashId'])
export class FlashLike {
  @PrimaryColumn({ name: 'user_id' })
  userId: string;

  @PrimaryColumn({ name: 'flash_id' })
  flashId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
