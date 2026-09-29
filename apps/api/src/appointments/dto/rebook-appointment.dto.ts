import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional, Length } from 'class-validator';

export class RebookAppointmentDto {
  @ApiProperty({ type: String, format: 'date-time', description: 'The follow-up slot start, as returned by the slots endpoint' })
  @IsISO8601()
  startsAt!: string;

  @ApiPropertyOptional({ minLength: 10, maxLength: 500, description: 'Defaults to "Follow-up: <original reason>"' })
  @IsOptional()
  @Length(10, 500)
  reason?: string;
}
