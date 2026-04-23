import {
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post as HttpPost,
  Body,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { StoriesService } from './stories.service';
import { MessagesService } from '../messages/messages.service';
import { UploadService } from '../upload/upload.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { mediaMulterConfig } from '../../common/upload/multer.config';

@Controller('stories')
export class StoriesController {
  constructor(
    private readonly stories: StoriesService,
    private readonly uploadService: UploadService,
    private readonly messages: MessagesService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @HttpPost()
  @UseInterceptors(FileInterceptor('media', mediaMulterConfig))
  async create(
    @CurrentUser() user: { sub: string },
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Media file required');
    const result = await this.uploadService.upload(file, 'stories');
    const mediaType = file.mimetype.startsWith('video/') ? 'video' : 'image';
    return this.stories.create(user.sub, result.url, mediaType);
  }

  @UseGuards(JwtAuthGuard)
  @Get('feed')
  feed(@CurrentUser() user: { sub: string }) {
    return this.stories.feed(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @HttpPost(':id/view')
  view(
    @CurrentUser() user: { sub: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.stories.markViewed(id, user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @HttpPost(':id/like')
  like(
    @CurrentUser() user: { sub: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.stories.like(id, user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id/like')
  unlike(
    @CurrentUser() user: { sub: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.stories.unlike(id, user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/viewers')
  viewers(
    @CurrentUser() user: { sub: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.stories.getViewers(id, user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @HttpPost(':id/reply')
  async reply(
    @CurrentUser() user: { sub: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Body('message') message: string,
  ) {
    if (!message || !message.trim()) throw new BadRequestException('Message required');
    const story = await this.stories.findById(id);
    if (!story) throw new BadRequestException('Story not found');
    // Send a chat message to the story owner with the story media and storyId
    const msg = await this.messages.create(
      user.sub,
      story.userId,
      message.trim(),
      [],
      story.id,
      story.mediaUrl,
    );
    return { ok: true, message: msg };
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(
    @CurrentUser() user: { sub: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.stories.remove(id, user.sub);
  }
}
