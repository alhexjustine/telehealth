import { ApiProperty } from '@nestjs/swagger';
import type { MatchReasonSource } from '../matching-engine.js';

export const MATCH_REASON_SOURCES: MatchReasonSource[] = ['selected', 'described', 'age', 'default'];

export class MatchReasonDto {
  @ApiProperty({ nullable: true, type: String }) symptomId!: string | null;
  @ApiProperty({ nullable: true, type: String }) symptomName!: string | null;
  @ApiProperty() specializationId!: string;
  @ApiProperty() specializationName!: string;
  @ApiProperty() weight!: number;
  @ApiProperty({ enum: MATCH_REASON_SOURCES }) source!: MatchReasonSource;
}

export class MatchedSymptomDto {
  @ApiProperty() symptomId!: string;
  @ApiProperty() symptomName!: string;
  @ApiProperty({ enum: ['selected', 'described'] }) source!: 'selected' | 'described';
}

export class RedFlagDto {
  @ApiProperty() symptomId!: string;
  @ApiProperty() symptomName!: string;
}

export class SpecializationMatchDto {
  @ApiProperty() specializationId!: string;
  @ApiProperty() specializationName!: string;
  @ApiProperty() score!: number;
  @ApiProperty({ type: [MatchReasonDto] }) reasons!: MatchReasonDto[];
}

export class DoctorMatchDto {
  @ApiProperty() doctorId!: string;
  @ApiProperty() displayName!: string;
  @ApiProperty() specializationId!: string;
  @ApiProperty() score!: number;
  @ApiProperty({ type: [MatchReasonDto] }) reasons!: MatchReasonDto[];
  @ApiProperty({ nullable: true, type: String, format: 'date-time' }) nextAvailableSlot!: string | null;
}

export class MatchingResponseDto {
  @ApiProperty() urgent!: boolean;
  @ApiProperty({ nullable: true, type: String }) emergencyMessage!: string | null;
  @ApiProperty({ type: [RedFlagDto] }) redFlags!: RedFlagDto[];
  @ApiProperty({ type: [MatchedSymptomDto] }) matchedSymptoms!: MatchedSymptomDto[];
  @ApiProperty({ type: [SpecializationMatchDto] }) specializations!: SpecializationMatchDto[];
  @ApiProperty({ type: [DoctorMatchDto] }) doctors!: DoctorMatchDto[];
  @ApiProperty({ description: 'True when the age rule could not run because the patient has no birthday on file' })
  ageUnknown!: boolean;
}
