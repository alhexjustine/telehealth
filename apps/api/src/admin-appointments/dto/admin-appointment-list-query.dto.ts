import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsISO8601, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { AppointmentStatus, SessionState } from '../../generated/prisma/enums.js';

export const DEFAULT_ADMIN_APPOINTMENT_PAGE_SIZE = 20;
export const MAX_ADMIN_APPOINTMENT_PAGE_SIZE = 100;

export class AdminAppointmentListQueryDto {
  @ApiPropertyOptional({ enum: AppointmentStatus })
  @IsOptional()
  @IsEnum(AppointmentStatus)
  status?: AppointmentStatus;

  @ApiPropertyOptional({ enum: SessionState })
  @IsOptional()
  @IsEnum(SessionState)
  consultationState?: SessionState;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @IsISO8601()
  dateFrom?: string;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @IsISO8601()
  dateTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  doctorId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  patientId?: string;

  @ApiPropertyOptional({ description: 'Only appointments flagged NOT_COMPLETED or DOCTOR_UNAVAILABLE' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value === 'true' : Boolean(value)))
  @IsBoolean()
  invalidOnly?: boolean;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: MAX_ADMIN_APPOINTMENT_PAGE_SIZE, default: DEFAULT_ADMIN_APPOINTMENT_PAGE_SIZE })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_ADMIN_APPOINTMENT_PAGE_SIZE)
  pageSize?: number;
}
