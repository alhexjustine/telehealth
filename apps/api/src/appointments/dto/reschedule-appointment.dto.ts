import { ApiProperty } from '@nestjs/swagger';
import { IsISO8601 } from 'class-validator';

export class RescheduleAppointmentDto {
  @ApiProperty({ type: String, format: 'date-time', description: 'The new slot start, with the same doctor' })
  @IsISO8601()
  startsAt!: string;
}
