import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ExploreService } from './explore.service';
import { OptionalJwtGuard } from '../../common/guards/optional-jwt.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('explore')
export class ExploreController {
  constructor(private readonly explore: ExploreService) {}

  @Get('trending')
  trending(@Query('limit') limit?: string) {
    return this.explore.trending(Number(limit) || 15);
  }

  @UseGuards(OptionalJwtGuard)
  @Get('search')
  search(
    @CurrentUser() user: { sub: string } | null,
    @Query('tag') tag: string,
    @Query('limit') limit?: string,
  ) {
    return this.explore.searchByTag(tag, user?.sub ?? null, Number(limit) || 20);
  }

  @Get('flashes')
  flashes(@Query('limit') limit?: string) {
    return this.explore.exploreFlashes(Number(limit) || 9);
  }
}
