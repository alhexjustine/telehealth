import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Res } from '@nestjs/common';
import { ApiCookieAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthUser } from '../auth/current-user.js';
import { Role } from '../generated/prisma/enums.js';
import { ErrorResponseDto } from '../common/dto/error-response.dto.js';
import { FavoritesService } from './favorites.service.js';
import { FavoriteDoctorDto } from './dto/favorite-doctor.dto.js';
import { FavoriteListResponseDto, FavoriteResponseDto } from './dto/favorite-response.dto.js';

@ApiTags('favorites')
@ApiCookieAuth('th_session')
@Controller('patients/me/favorites')
@Roles(Role.PATIENT)
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Post()
  @ApiOperation({ summary: "Favorites a doctor for the signed-in patient (idempotent: 200 if already favorited)" })
  @ApiCreatedResponse({ type: FavoriteResponseDto })
  @ApiOkResponse({ type: FavoriteResponseDto, description: 'Already favorited (no-op)' })
  @ApiResponse({ status: 409, description: 'FAVORITE_LIMIT_REACHED', type: ErrorResponseDto })
  async favorite(
    @CurrentUser() user: AuthUser,
    @Body() dto: FavoriteDoctorDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<FavoriteResponseDto> {
    const { dto: favorite, created } = await this.favoritesService.favorite(user.id, dto.doctorId);
    res.status(created ? HttpStatus.CREATED : HttpStatus.OK);
    return favorite;
  }

  @Delete(':doctorId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Unfavorites a doctor for the signed-in patient (idempotent no-op if not favorited)" })
  async unfavorite(
    @CurrentUser() user: AuthUser,
    @Param('doctorId', new ParseUUIDPipe({ version: '4' })) doctorId: string,
  ): Promise<void> {
    await this.favoritesService.unfavorite(user.id, doctorId);
  }

  @Get()
  @ApiOperation({ summary: "Lists the signed-in patient's favorited doctors, with live discovery summaries" })
  @ApiOkResponse({ type: FavoriteListResponseDto })
  async list(@CurrentUser() user: AuthUser): Promise<FavoriteListResponseDto> {
    return { items: await this.favoritesService.list(user.id) };
  }
}
