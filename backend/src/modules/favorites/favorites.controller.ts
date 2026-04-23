import {
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { FavoritesService } from './favorites.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller()
export class FavoritesController {
  constructor(private readonly favorites: FavoritesService) {}

  @UseGuards(JwtAuthGuard)
  @Post('posts/:postId/save')
  save(
    @CurrentUser() u: { sub: string },
    @Param('postId', ParseUUIDPipe) postId: string,
  ) {
    return this.favorites.save(u.sub, postId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('posts/:postId/save')
  unsave(
    @CurrentUser() u: { sub: string },
    @Param('postId', ParseUUIDPipe) postId: string,
  ) {
    return this.favorites.unsave(u.sub, postId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('users/:userId/favorites')
  list(
    @CurrentUser() u: { sub: string },
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.favorites.listByUser(userId, u.sub, Number(limit) || 20, cursor);
  }
}
