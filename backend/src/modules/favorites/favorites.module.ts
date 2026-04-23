import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Favorite } from './entities/favorite.entity';
import { Like } from '../likes/entities/like.entity';
import { FavoritesService } from './favorites.service';
import { FavoritesController } from './favorites.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Favorite, Like])],
  providers: [FavoritesService],
  controllers: [FavoritesController],
  exports: [FavoritesService, TypeOrmModule],
})
export class FavoritesModule {}
