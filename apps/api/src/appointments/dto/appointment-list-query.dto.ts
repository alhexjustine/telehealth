import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export const APPOINTMENT_SCOPES = ['upcoming', 'past'] as const;
export type AppointmentScope = (typeof APPOINTMENT_SCOPES)[number];

export const DEFAULT_APPOINTMENT_PAGE_SIZE = 20;
export const MAX_APPOINTMENT_PAGE_SIZE = 50;

export class AppointmentListQueryDto {
  @ApiProperty({ enum: APPOINTMENT_SCOPES })
  @IsIn(APPOINTMENT_SCOPES)
  scope!: AppointmentScope;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: MAX_APPOINTMENT_PAGE_SIZE, default: DEFAULT_APPOINTMENT_PAGE_SIZE })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_APPOINTMENT_PAGE_SIZE)
  pageSize?: number;
}
