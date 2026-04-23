import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Post } from '../posts/entities/post.entity';
import { Flash } from '../flashes/entities/flash.entity';
import { ExploreService } from './explore.service';
import { ExploreController } from './explore.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Post, Flash])],
  providers: [ExploreService],
  controllers: [ExploreController],
})
export class ExploreModule {}
