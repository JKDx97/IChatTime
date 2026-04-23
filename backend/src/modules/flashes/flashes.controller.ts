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
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { FlashesService } from './flashes.service';
import { UploadService } from '../upload/upload.service';
import { CreateFlashDto } from './dto/create-flash.dto';
import { CreateFlashCommentDto } from './dto/create-flash-comment.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OptionalJwtGuard } from '../../common/guards/optional-jwt.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { mediaMulterConfig } from '../../common/upload/multer.config';

@Controller('flashes')
export class FlashesController {
  constructor(
    private readonly flashes: FlashesService,
    private readonly uploadService: UploadService,
  ) {}

  /* ─── CRUD ─────────────────────────────── */

  @UseGuards(JwtAuthGuard)
  @HttpPost()
  @UseInterceptors(FileInterceptor('video', mediaMulterConfig))
  async create(
    @CurrentUser() user: { sub: string },
    @Body() dto: CreateFlashDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Debes subir un video');
    if (!file.mimetype.startsWith('video/')) {
      throw new BadRequestException('Solo se permiten videos');
    }
    const result = await this.uploadService.upload(file, 'flashes');
    return this.flashes.create(user.sub, result.url, dto.description ?? '');
  }

  @UseGuards(OptionalJwtGuard)
  @Get('feed')
  feed(
    @CurrentUser() user: { sub: string } | null,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    if (!user) return { items: [], nextCursor: null };
    return this.flashes.feed(user.sub, Number(limit) || 10, cursor);
  }

  @UseGuards(OptionalJwtGuard)
  @Get('random')
  random(
    @CurrentUser() user: { sub: string } | null,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    if (!user) return { items: [], hasMore: false };
    return this.flashes.randomFeed(user.sub, Number(limit) || 10, Number(offset) || 0);
  }

  @UseGuards(OptionalJwtGuard)
  @Get('user/:userId')
  byUser(
    @CurrentUser() user: { sub: string } | null,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.flashes.byUser(userId, user?.sub ?? null, Number(limit) || 10, cursor);
  }

  @UseGuards(OptionalJwtGuard)
  @Get(':id')
  one(
    @CurrentUser() user: { sub: string } | null,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.flashes.findById(id, user?.sub ?? null);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(
    @CurrentUser() user: { sub: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.flashes.remove(id, user.sub);
  }

  /* ─── LIKES ────────────────────────────── */

  @UseGuards(JwtAuthGuard)
  @HttpPost(':id/like')
  like(
    @CurrentUser() user: { sub: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.flashes.like(user.sub, id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id/like')
  unlike(
    @CurrentUser() user: { sub: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.flashes.unlike(user.sub, id);
  }

  /* ─── COMMENTS ─────────────────────────── */

  @Get(':flashId/comments')
  listComments(
    @Param('flashId', ParseUUIDPipe) flashId: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.flashes.listComments(flashId, Number(limit) || 30, cursor);
  }

  @Get('comments/:commentId/replies')
  listCommentReplies(
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.flashes.listCommentReplies(commentId, Number(limit) || 30, cursor);
  }

  @UseGuards(JwtAuthGuard)
  @HttpPost(':flashId/comments')
  createComment(
    @CurrentUser() user: { sub: string },
    @Param('flashId', ParseUUIDPipe) flashId: string,
    @Body() dto: CreateFlashCommentDto,
  ) {
    return this.flashes.createComment(user.sub, flashId, dto.content, dto.parentId, dto.mediaUrls);
  }

  @UseGuards(JwtAuthGuard)
  @HttpPost('comments/upload')
  @UseInterceptors(FilesInterceptor('media', 5, mediaMulterConfig))
  async uploadCommentMedia(@UploadedFiles() files: Express.Multer.File[]) {
    const results = await Promise.all(
      files.map((f) => this.uploadService.upload(f, 'flash-comments')),
    );
    return { urls: results.map((r) => r.url) };
  }

  @UseGuards(JwtAuthGuard)
  @Delete('comments/:id')
  removeComment(
    @CurrentUser() user: { sub: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.flashes.removeComment(id, user.sub);
  }
}
