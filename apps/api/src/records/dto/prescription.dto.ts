import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class CreatePrescriptionDto {
  @ApiProperty({ minLength: 1, maxLength: 120 })
  @IsString()
  @Length(1, 120)
  medication!: string;

  @ApiProperty({ minLength: 1, maxLength: 60 })
  @IsString()
  @Length(1, 60)
  dosage!: string;

  @ApiProperty({ minLength: 1, maxLength: 60 })
  @IsString()
  @Length(1, 60)
  frequency!: string;

  @ApiProperty({ minLength: 1, maxLength: 60 })
  @IsString()
  @Length(1, 60)
  duration!: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  instructions?: string;
}

export class UpdatePrescriptionDto {
  @ApiPropertyOptional({ minLength: 1, maxLength: 120 })
  @IsOptional()
  @IsString()
  @Length(1, 120)
  medication?: string;

  @ApiPropertyOptional({ minLength: 1, maxLength: 60 })
  @IsOptional()
  @IsString()
  @Length(1, 60)
  dosage?: string;

  @ApiPropertyOptional({ minLength: 1, maxLength: 60 })
  @IsOptional()
  @IsString()
  @Length(1, 60)
  frequency?: string;

  @ApiPropertyOptional({ minLength: 1, maxLength: 60 })
  @IsOptional()
  @IsString()
  @Length(1, 60)
  duration?: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  instructions?: string;
}
