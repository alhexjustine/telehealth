import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { RefillRequestStatus } from '../../generated/prisma/enums.js';

export const DEFAULT_REFILL_REQUEST_PAGE_SIZE = 20;
export const MAX_REFILL_REQUEST_PAGE_SIZE = 50;

export class RefillRequestListQueryDto {
  @ApiPropertyOptional({ enum: RefillRequestStatus, description: 'Omit to list every status' })
  @IsOptional()
  @IsEnum(RefillRequestStatus)
  status?: RefillRequestStatus;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: MAX_REFILL_REQUEST_PAGE_SIZE, default: DEFAULT_REFILL_REQUEST_PAGE_SIZE })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_REFILL_REQUEST_PAGE_SIZE)
  pageSize?: number;
}
