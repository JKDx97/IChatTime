import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post as HttpPost,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { PostsService } from './posts.service';
import { LikesService } from '../likes/likes.service';
import { UploadService } from '../upload/upload.service';
import { CreatePostDto } from './dto/create-post.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OptionalJwtGuard } from '../../common/guards/optional-jwt.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { mediaMulterConfig } from '../../common/upload/multer.config';

@Controller('posts')
export class PostsController {
  constructor(
    private readonly posts: PostsService,
    private readonly likes: LikesService,
    private readonly uploadService: UploadService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @HttpPost()
  @UseInterceptors(FilesInterceptor('media', 10, mediaMulterConfig))
  async create(
    @CurrentUser() user: { sub: string },
    @Body() dto: CreatePostDto,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    if ((!files || files.length === 0) && !dto.content?.trim()) {
      throw new BadRequestException('Debes escribir algo o subir al menos una imagen o video');
    }
    const mediaUrls: string[] = [];
    for (const file of files ?? []) {
      const result = await this.uploadService.upload(file, 'posts');
      mediaUrls.push(result.url);
    }
    return this.posts.create(user.sub, dto, mediaUrls);
  }

  @UseGuards(OptionalJwtGuard)
  @Get('feed')
  feed(
    @CurrentUser() user: { sub: string } | null,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    if (!user) return { items: [], nextCursor: null };
    return this.posts.listFeed(user.sub, Number(limit) || 20, cursor);
  }

  @UseGuards(OptionalJwtGuard)
  @Get('user/:userId')
  byUser(
    @CurrentUser() user: { sub: string } | null,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
    @Query('textOnly') textOnly?: string,
    @Query('withMedia') withMedia?: string,
  ) {
    return this.posts.listByUser(
      userId,
      user?.sub ?? null,
      Number(limit) || 20,
      cursor,
      textOnly === 'true',
      withMedia === 'true',
    );
  }

  @UseGuards(OptionalJwtGuard)
  @Get(':id')
  one(
    @CurrentUser() user: { sub: string } | null,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.posts.findById(id, user?.sub ?? null);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(
    @CurrentUser() user: { sub: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.posts.remove(id, user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @HttpPost(':id/like')
  likePost(
    @CurrentUser() user: { sub: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.likes.like(user.sub, id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id/like')
  unlikePost(
    @CurrentUser() user: { sub: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.likes.unlike(user.sub, id);
  }
}
