import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { LICENSE_NUMBER_PATTERN } from '../license-number.js';

export const ALLOWED_CONSULTATION_MINUTES = [15, 20, 30, 45, 60] as const;

export class UpdateDoctorProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 100)
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 100)
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  bio?: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 70 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(70)
  yearsOfExperience?: number;

  @ApiPropertyOptional({ description: '4-32 letters, digits, or dashes' })
  @IsOptional()
  @IsString()
  @Matches(LICENSE_NUMBER_PATTERN)
  licenseNumber?: string;

  @ApiPropertyOptional({ enum: ALLOWED_CONSULTATION_MINUTES })
  @IsOptional()
  @IsIn(ALLOWED_CONSULTATION_MINUTES)
  consultationMinutes?: number;

  @ApiPropertyOptional({
    type: [String],
    description: 'Replaces the full set of specializations; at least one is required when provided',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  specializationIds?: string[];
}
