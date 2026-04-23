import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Flash } from './entities/flash.entity';
import { FlashLike } from './entities/flash-like.entity';
import { FlashComment } from './entities/flash-comment.entity';
import { FlashesService } from './flashes.service';
import { FlashesController } from './flashes.controller';
import { UploadModule } from '../upload/upload.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Flash, FlashLike, FlashComment]),
    UploadModule,
  ],
  providers: [FlashesService],
  controllers: [FlashesController],
  exports: [FlashesService],
})
export class FlashesModule {}
