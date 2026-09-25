import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateTimeOffDto {
  @ApiProperty({ type: String, format: 'date-time' })
  @IsISO8601()
  startsAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  @IsISO8601()
  endsAt!: string;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}
