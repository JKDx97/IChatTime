import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Post } from './entities/post.entity';
import { Like } from '../likes/entities/like.entity';
import { Favorite } from '../favorites/entities/favorite.entity';
import { PostsService } from './posts.service';
import { PostsController } from './posts.controller';
import { LikesModule } from '../likes/likes.module';
import { UploadModule } from '../upload/upload.module';

@Module({
  imports: [TypeOrmModule.forFeature([Post, Like, Favorite]), LikesModule, UploadModule],
  providers: [PostsService],
  controllers: [PostsController],
  exports: [PostsService, TypeOrmModule],
})
export class PostsModule {}
