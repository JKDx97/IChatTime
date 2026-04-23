import {
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { FriendRequestsService } from './friend-requests.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('friend-requests')
@UseGuards(JwtAuthGuard)
export class FriendRequestsController {
  constructor(
    private readonly service: FriendRequestsService,
    private readonly gateway: NotificationsGateway,
  ) {}

  /** Send a friend request to a user */
  @Post('send/:userId')
  send(
    @CurrentUser() u: { sub: string },
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.service.send(u.sub, userId);
  }

  /** Accept an incoming friend request */
  @Post(':id/accept')
  accept(
    @CurrentUser() u: { sub: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.accept(id, u.sub);
  }

  /** Reject an incoming friend request */
  @Post(':id/reject')
  reject(
    @CurrentUser() u: { sub: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.reject(id, u.sub);
  }

  /** Cancel a sent friend request */
  @Delete(':id/cancel')
  cancel(
    @CurrentUser() u: { sub: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.cancel(id, u.sub);
  }

  /** Remove a friend (unfriend) */
  @Delete(':id/unfriend')
  unfriend(
    @CurrentUser() u: { sub: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.unfriend(id, u.sub);
  }

  /** List my pending incoming requests */
  @Get('pending')
  pending(@CurrentUser() u: { sub: string }) {
    return this.service.listPending(u.sub);
  }

  /** Count my pending incoming requests */
  @Get('pending/count')
  pendingCount(@CurrentUser() u: { sub: string }) {
    return this.service.countPending(u.sub);
  }

  /** Get friendship status with another user */
  @Get('status/:userId')
  status(
    @CurrentUser() u: { sub: string },
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.service.getStatus(u.sub, userId);
  }

  /** List my friends with online status */
  @Get('friends')
  async friends(@CurrentUser() u: { sub: string }) {
    const friends = await this.service.listFriends(u.sub);
    return friends.map((f) => ({
      ...f,
      online: this.gateway.isOnline(f.id),
    }));
  }
}
