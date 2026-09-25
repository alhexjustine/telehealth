import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsISO8601, IsOptional, IsUUID, Length } from 'class-validator';

export class CreateAppointmentDto {
  @ApiProperty() @IsUUID('4') doctorId!: string;

  @ApiProperty({ type: String, format: 'date-time', description: 'The slot start, as returned by the slots endpoint' })
  @IsISO8601()
  startsAt!: string;

  @ApiProperty({ minLength: 10, maxLength: 500 })
  @Length(10, 500)
  reason!: string;

  @ApiPropertyOptional({ type: [String], maxItems: 10, description: 'Symptom IDs carried over from guided matching' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUUID('4', { each: true })
  symptomIds?: string[];
}
