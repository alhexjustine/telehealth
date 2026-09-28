import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { IsBirthDate } from '../../patients/dto/is-birth-date.decorator.js';
import { DependentRelationship } from '../../generated/prisma/enums.js';

export class UpdateDependentDto {
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

  @ApiPropertyOptional({ example: '2018-06-15' })
  @IsOptional()
  @IsBirthDate()
  birthDate?: string;

  @ApiPropertyOptional({ enum: DependentRelationship })
  @IsOptional()
  @IsEnum(DependentRelationship)
  relationship?: DependentRelationship;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  medicalConditions?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  allergies?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  currentMedications?: string;
}
