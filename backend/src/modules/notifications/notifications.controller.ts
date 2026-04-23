import { Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifs: NotificationsService) {}

  @Get()
  list(
    @CurrentUser() u: { sub: string },
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.notifs.list(u.sub, Number(limit) || 30, cursor);
  }

  @Get('unread-count')
  async unread(@CurrentUser() u: { sub: string }) {
    const count = await this.notifs.unreadCount(u.sub);
    return { count };
  }

  @Post('read-all')
  readAll(@CurrentUser() u: { sub: string }) {
    return this.notifs.markAllRead(u.sub);
  }

  @Delete(':id')
  deleteOne(@CurrentUser() u: { sub: string }, @Param('id') id: string) {
    return this.notifs.deleteOne(u.sub, id);
  }

  @Delete()
  deleteAll(@CurrentUser() u: { sub: string }) {
    return this.notifs.deleteAll(u.sub);
  }
}
