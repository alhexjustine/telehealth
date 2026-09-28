import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { IsBirthDate } from '../../patients/dto/is-birth-date.decorator.js';
import { DependentRelationship } from '../../generated/prisma/enums.js';

export class CreateDependentDto {
  @ApiProperty()
  @IsString()
  @Length(1, 100)
  firstName!: string;

  @ApiProperty()
  @IsString()
  @Length(1, 100)
  lastName!: string;

  @ApiProperty({ example: '2018-06-15' })
  @IsBirthDate()
  birthDate!: string;

  @ApiProperty({ enum: DependentRelationship })
  @IsEnum(DependentRelationship)
  relationship!: DependentRelationship;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  medicalConditions?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  allergies?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  currentMedications?: string;
}
