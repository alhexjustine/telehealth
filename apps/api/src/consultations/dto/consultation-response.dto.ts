import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SessionState } from '../../generated/prisma/enums.js';
import {
  AppointmentDoctorSummaryDto,
  AppointmentPatientSummaryDto,
  AppointmentSymptomSummaryDto,
} from '../../appointments/dto/appointment-response.dto.js';

export class ConsultationSessionStateDto {
  @ApiProperty({ enum: SessionState }) state!: SessionState;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) patientJoinedAt!: string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) doctorJoinedAt!: string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) startedAt!: string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) completedAt!: string | null;
}

/** Doctor-only: the patient's medical-history summary, shown alongside the workspace. */
export class ConsultationPatientSummaryDto {
  @ApiProperty({ nullable: true, type: Number }) age!: number | null;
  @ApiProperty({ nullable: true, type: String }) medicalConditions!: string | null;
  @ApiProperty({ nullable: true, type: String }) allergies!: string | null;
  @ApiProperty({ nullable: true, type: String }) currentMedications!: string | null;
}

export class ConsultationNoteDto {
  @ApiProperty({ nullable: true, type: String }) findings!: string | null;
  @ApiProperty({ nullable: true, type: String }) assessment!: string | null;
  @ApiProperty({ nullable: true, type: String }) plan!: string | null;
  @ApiProperty({ nullable: true, type: String }) patientSummary!: string | null;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt!: string;
}

export class PrescriptionResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() medication!: string;
  @ApiProperty() dosage!: string;
  @ApiProperty() frequency!: string;
  @ApiProperty() duration!: string;
  @ApiProperty({ nullable: true, type: String }) instructions!: string | null;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: string;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt!: string;
}

/**
 * The consultation workspace. `patientMedicalSummary` is only present for
 * the doctor caller; `note`/`prescriptions` are always present for the
 * doctor, and present for the patient only once the session is `COMPLETED`
 * — see `ClinicalAccessPolicy` and the "Workspace access" requirement.
 */
export class ConsultationWorkspaceResponseDto {
  @ApiProperty() appointmentId!: string;
  @ApiProperty({ type: String, format: 'date-time' }) startsAt!: string;
  @ApiProperty({ type: String, format: 'date-time' }) endsAt!: string;
  @ApiProperty() reason!: string;
  @ApiProperty({ type: AppointmentDoctorSummaryDto }) doctor!: AppointmentDoctorSummaryDto;
  @ApiProperty({ type: AppointmentPatientSummaryDto }) patient!: AppointmentPatientSummaryDto;
  @ApiProperty({ type: [AppointmentSymptomSummaryDto] }) symptoms!: AppointmentSymptomSummaryDto[];
  @ApiProperty({ type: ConsultationSessionStateDto }) session!: ConsultationSessionStateDto;
  @ApiPropertyOptional({ type: ConsultationPatientSummaryDto, nullable: true })
  patientMedicalSummary?: ConsultationPatientSummaryDto | null;
  @ApiPropertyOptional({ type: ConsultationNoteDto, nullable: true }) note?: ConsultationNoteDto | null;
  @ApiPropertyOptional({ type: [PrescriptionResponseDto] }) prescriptions?: PrescriptionResponseDto[];
}
