import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';

export const MAX_REFILL_NOTE_LENGTH = 500;

export class RequestRefillDto {
  @ApiPropertyOptional({ maxLength: MAX_REFILL_NOTE_LENGTH })
  @IsOptional()
  @IsString()
  @Length(0, MAX_REFILL_NOTE_LENGTH)
  patientNote?: string;
}
