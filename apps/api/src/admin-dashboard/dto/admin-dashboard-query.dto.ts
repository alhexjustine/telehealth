import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class AdminDashboardQueryDto {
  @ApiPropertyOptional({ description: 'IANA time zone used for "today" and the daily buckets', default: 'UTC' })
  @IsOptional()
  @IsString()
  tz?: string;
}
