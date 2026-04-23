import {
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { MessagesService } from './messages.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UploadService } from '../upload/upload.service';
import { mediaMulterConfig } from '../../common/upload/multer.config';
import { MessagesGateway } from './messages.gateway';

@UseGuards(JwtAuthGuard)
@Controller('messages')
export class MessagesController {
  constructor(
    private readonly messagesService: MessagesService,
    private readonly uploadService: UploadService,
    private readonly gateway: MessagesGateway,
  ) {}

  @Get('conversations')
  getConversations(@CurrentUser() u: { sub: string }) {
    return this.messagesService.getConversations(u.sub);
  }

  @Get('unread-count')
  async unreadCount(@CurrentUser() u: { sub: string }) {
    const count = await this.messagesService.unreadCount(u.sub);
    return { count };
  }

  @Get('conversation/:userId')
  getMessages(
    @CurrentUser() u: { sub: string },
    @Param('userId') userId: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.messagesService.getMessages(
      u.sub,
      userId,
      Number(limit) || 40,
      cursor,
    );
  }

  @Patch(':userId/read')
  async markRead(
    @CurrentUser() u: { sub: string },
    @Param('userId') userId: string,
  ) {
    const count = await this.messagesService.markAsRead(u.sub, userId);
    return { marked: count };
  }

  @Post('upload')
  @UseInterceptors(FilesInterceptor('media', 10, mediaMulterConfig))
  async uploadMedia(
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    const results = await Promise.all(
      files.map((f) => this.uploadService.upload(f, 'messages')),
    );
    return { urls: results.map((r) => r.url) };
  }

  @Delete(':messageId/for-me')
  async deleteForMe(
    @CurrentUser() u: { sub: string },
    @Param('messageId') messageId: string,
  ) {
    const ok = await this.messagesService.deleteForMe(messageId, u.sub);
    return { ok };
  }

  @Delete(':messageId/for-all')
  async deleteForAll(
    @CurrentUser() u: { sub: string },
    @Param('messageId') messageId: string,
  ) {
    const msg = await this.messagesService.deleteForAll(messageId, u.sub);
    if (msg) {
      // Notify both sender and receiver in real time
      this.gateway.emitToUser(msg.senderId, 'message_deleted_for_all', { messageId: msg.id });
      this.gateway.emitToUser(msg.receiverId, 'message_deleted_for_all', { messageId: msg.id });
    }
    return { ok: !!msg };
  }
}
