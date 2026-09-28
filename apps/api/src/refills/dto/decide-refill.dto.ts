import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';
import { MAX_REFILL_NOTE_LENGTH } from './request-refill.dto.js';

export class DecideRefillDto {
  @ApiPropertyOptional({ maxLength: MAX_REFILL_NOTE_LENGTH })
  @IsOptional()
  @IsString()
  @Length(0, MAX_REFILL_NOTE_LENGTH)
  doctorNote?: string;
}
