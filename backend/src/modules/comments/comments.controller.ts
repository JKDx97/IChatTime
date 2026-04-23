import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UploadService } from '../upload/upload.service';
import { mediaMulterConfig } from '../../common/upload/multer.config';

@Controller()
export class CommentsController {
  constructor(
    private readonly comments: CommentsService,
    private readonly uploadService: UploadService,
  ) {}

  @Get('posts/:postId/comments')
  list(
    @Param('postId', ParseUUIDPipe) postId: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.comments.listByPost(postId, Number(limit) || 30, cursor);
  }

  @Get('comments/:commentId/replies')
  listReplies(
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.comments.listReplies(commentId, Number(limit) || 30, cursor);
  }

  @UseGuards(JwtAuthGuard)
  @Post('posts/:postId/comments')
  create(
    @CurrentUser() u: { sub: string },
    @Param('postId', ParseUUIDPipe) postId: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.comments.create(u.sub, postId, dto.content, dto.parentId, dto.mediaUrls);
  }

  @UseGuards(JwtAuthGuard)
  @Post('comments/upload')
  @UseInterceptors(FilesInterceptor('media', 5, mediaMulterConfig))
  async uploadMedia(@UploadedFiles() files: Express.Multer.File[]) {
    const results = await Promise.all(
      files.map((f) => this.uploadService.upload(f, 'comments')),
    );
    return { urls: results.map((r) => r.url) };
  }

  @UseGuards(JwtAuthGuard)
  @Delete('comments/:id')
  remove(
    @CurrentUser() u: { sub: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.comments.remove(id, u.sub);
  }
}
