import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Shared by patient and doctor cancellation: a patient's reason is optional,
 * a doctor's is required (5-500 characters) — enforced in the service since
 * it depends on the caller's role, not on the request shape alone.
 */
export class CancelAppointmentDto {
  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
