import {
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { FollowsService } from './follows.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OptionalJwtGuard } from '../../common/guards/optional-jwt.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('users/:userId')
export class FollowsController {
  constructor(private readonly follows: FollowsService) {}

  @UseGuards(JwtAuthGuard)
  @Post('follow')
  follow(
    @CurrentUser() u: { sub: string },
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.follows.follow(u.sub, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('follow')
  unfollow(
    @CurrentUser() u: { sub: string },
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.follows.unfollow(u.sub, userId);
  }

  @UseGuards(OptionalJwtGuard)
  @Get('stats')
  stats(
    @CurrentUser() u: { sub: string } | null,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.follows.stats(userId, u?.sub ?? null);
  }

  @Get('followers')
  followers(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.follows.listFollowers(userId);
  }

  @Get('following')
  following(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.follows.listFollowing(userId);
  }
}
