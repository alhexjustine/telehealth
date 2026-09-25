import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { VerificationStatus } from '../../generated/prisma/enums.js';

export const DEFAULT_ADMIN_DOCTOR_PAGE_SIZE = 20;
export const MAX_ADMIN_DOCTOR_PAGE_SIZE = 100;

export class AdminDoctorListQueryDto {
  @ApiPropertyOptional({ enum: VerificationStatus, default: VerificationStatus.PENDING })
  @IsOptional()
  @IsEnum(VerificationStatus)
  verification?: VerificationStatus;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: MAX_ADMIN_DOCTOR_PAGE_SIZE, default: DEFAULT_ADMIN_DOCTOR_PAGE_SIZE })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_ADMIN_DOCTOR_PAGE_SIZE)
  pageSize?: number;
}
