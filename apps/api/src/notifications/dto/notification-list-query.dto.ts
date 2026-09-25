import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export const DEFAULT_NOTIFICATION_PAGE_SIZE = 20;
export const MAX_NOTIFICATION_PAGE_SIZE = 50;

export class NotificationListQueryDto {
  @ApiPropertyOptional({ default: false, description: 'When true, only unread notifications are returned' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  unreadOnly?: boolean;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: MAX_NOTIFICATION_PAGE_SIZE, default: DEFAULT_NOTIFICATION_PAGE_SIZE })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_NOTIFICATION_PAGE_SIZE)
  pageSize?: number;
}
