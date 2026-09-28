import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsISO8601, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export const DOCTOR_SORT_OPTIONS = ['next', 'name', 'experience', 'rating'] as const;
export type DoctorSortOption = (typeof DOCTOR_SORT_OPTIONS)[number];

export const DEFAULT_PAGE_SIZE = 12;
export const MAX_PAGE_SIZE = 50;

export class SearchDoctorsQueryDto {
  @ApiPropertyOptional({ description: 'Matches doctor name or specialization name, case-insensitive' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @ApiPropertyOptional({ description: 'Specialization slug, e.g. cardiology' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  specialization?: string;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @IsISO8601()
  availableFrom?: string;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @IsISO8601()
  availableTo?: string;

  @ApiPropertyOptional({ enum: DOCTOR_SORT_OPTIONS, default: 'next' })
  @IsOptional()
  @IsIn(DOCTOR_SORT_OPTIONS)
  sort?: DoctorSortOption;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: MAX_PAGE_SIZE, default: DEFAULT_PAGE_SIZE })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  pageSize?: number;
}
