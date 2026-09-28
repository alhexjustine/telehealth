import { ApiProperty } from '@nestjs/swagger';
import { DependentRelationship } from '../../generated/prisma/enums.js';

export class DependentResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() firstName!: string;
  @ApiProperty() lastName!: string;
  @ApiProperty({ type: String, format: 'date' }) birthDate!: string;
  @ApiProperty({ enum: DependentRelationship }) relationship!: DependentRelationship;
  @ApiProperty({ nullable: true, type: String }) medicalConditions!: string | null;
  @ApiProperty({ nullable: true, type: String }) allergies!: string | null;
  @ApiProperty({ nullable: true, type: String }) currentMedications!: string | null;
}

export class DependentListResponseDto {
  @ApiProperty({ type: [DependentResponseDto] }) items!: DependentResponseDto[];
}
