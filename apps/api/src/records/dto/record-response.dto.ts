import { ApiProperty } from '@nestjs/swagger';
import { AppointmentStatus } from '../../generated/prisma/enums.js';
import { AppointmentDoctorSummaryDto } from '../../appointments/dto/appointment-response.dto.js';
import { ConsultationNoteDto, PrescriptionResponseDto } from '../../consultations/dto/consultation-response.dto.js';

export class RecordListItemDto {
  @ApiProperty() appointmentId!: string;
  @ApiProperty({ type: String, format: 'date-time' }) startsAt!: string;
  @ApiProperty({ type: AppointmentDoctorSummaryDto }) doctor!: AppointmentDoctorSummaryDto;
  @ApiProperty({ nullable: true, type: String }) patientSummary!: string | null;
}

export class RecordListResponseDto {
  @ApiProperty({ type: [RecordListItemDto] }) items!: RecordListItemDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
}

export class RecordDetailResponseDto {
  @ApiProperty() appointmentId!: string;
  @ApiProperty({ type: String, format: 'date-time' }) startsAt!: string;
  @ApiProperty({ type: AppointmentDoctorSummaryDto }) doctor!: AppointmentDoctorSummaryDto;
  @ApiProperty({ type: ConsultationNoteDto, nullable: true }) note!: ConsultationNoteDto | null;
  @ApiProperty({ type: [PrescriptionResponseDto] }) prescriptions!: PrescriptionResponseDto[];
}

export class DoctorPatientAppointmentDto {
  @ApiProperty() id!: string;
  @ApiProperty({ type: String, format: 'date-time' }) startsAt!: string;
  @ApiProperty({ type: String, format: 'date-time' }) endsAt!: string;
  @ApiProperty({ enum: AppointmentStatus }) status!: AppointmentStatus;
  @ApiProperty() reason!: string;
}

/**
 * The record a treating doctor sees for a patient: profile, medical
 * history, the appointments between them, and — for continuity of care —
 * the patient's completed consultations with any doctor (see design.md's
 * "Doctors see other doctors' notes for their patients").
 */
export class DoctorPatientRecordResponseDto {
  @ApiProperty() patientId!: string;
  @ApiProperty() firstName!: string;
  @ApiProperty() lastName!: string;
  @ApiProperty({ nullable: true, type: Number }) age!: number | null;
  @ApiProperty({ nullable: true, type: String }) medicalConditions!: string | null;
  @ApiProperty({ nullable: true, type: String }) allergies!: string | null;
  @ApiProperty({ nullable: true, type: String }) currentMedications!: string | null;
  @ApiProperty({ type: [DoctorPatientAppointmentDto] }) appointmentsWithDoctor!: DoctorPatientAppointmentDto[];
  @ApiProperty({ type: [RecordListItemDto] }) completedConsultations!: RecordListItemDto[];
}
