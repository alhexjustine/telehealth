import { ApiProperty } from '@nestjs/swagger';
import { AppointmentStatus, DependentRelationship, RefillRequestStatus } from '../../generated/prisma/enums.js';
import { AppointmentDependentSummaryDto, AppointmentDoctorSummaryDto } from '../../appointments/dto/appointment-response.dto.js';
import { ConsultationNoteDto, PrescriptionResponseDto } from '../../consultations/dto/consultation-response.dto.js';

/**
 * A prescription's refill-request history as shown inline on the record
 * detail page (`add-prescription-refills`) — deliberately slimmer than the
 * `refills` module's own `RefillRequestResponseDto`, since this one is
 * already nested under a specific prescription on a specific record and
 * doesn't need to repeat who/what it's for.
 */
export class RefillRequestDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: RefillRequestStatus }) status!: RefillRequestStatus;
  @ApiProperty({ nullable: true, type: String }) patientNote!: string | null;
  @ApiProperty({ nullable: true, type: String }) doctorNote!: string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) decidedAt!: string | null;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: string;
}

export class RecordPrescriptionDto extends PrescriptionResponseDto {
  @ApiProperty({ type: [RefillRequestDto], description: 'Newest first' }) refillRequests!: RefillRequestDto[];
}

export class RecordListItemDto {
  @ApiProperty() appointmentId!: string;
  @ApiProperty({ type: String, format: 'date-time' }) startsAt!: string;
  @ApiProperty({ type: AppointmentDoctorSummaryDto }) doctor!: AppointmentDoctorSummaryDto;
  @ApiProperty({
    type: AppointmentDependentSummaryDto,
    nullable: true,
    description: "Who this consultation was for, if not the account holder ('patient') themselves",
  })
  dependent!: AppointmentDependentSummaryDto | null;
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
  @ApiProperty({ type: AppointmentDependentSummaryDto, nullable: true }) dependent!: AppointmentDependentSummaryDto | null;
  @ApiProperty({ type: ConsultationNoteDto, nullable: true }) note!: ConsultationNoteDto | null;
  @ApiProperty({ type: [RecordPrescriptionDto] }) prescriptions!: RecordPrescriptionDto[];
}

export class DoctorPatientAppointmentDto {
  @ApiProperty() id!: string;
  @ApiProperty({ type: String, format: 'date-time' }) startsAt!: string;
  @ApiProperty({ type: String, format: 'date-time' }) endsAt!: string;
  @ApiProperty({ enum: AppointmentStatus }) status!: AppointmentStatus;
  @ApiProperty() reason!: string;
}

/**
 * The record a treating doctor sees for one specific person on a patient
 * account — the account holder, or one of their dependents (see
 * `add-dependent-booking`'s "each person's history is scoped
 * independently"): profile, medical history, the appointments between the
 * doctor and that same person, and — for continuity of care — that person's
 * completed consultations with any doctor (see design.md's "Doctors see
 * other doctors' notes for their patients").
 */
export class DoctorPatientRecordResponseDto {
  @ApiProperty() patientId!: string;
  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Set when this record is for one of the account\'s dependents rather than the account holder',
  })
  dependentId!: string | null;
  @ApiProperty({ enum: DependentRelationship, nullable: true }) relationship!: DependentRelationship | null;
  @ApiProperty() firstName!: string;
  @ApiProperty() lastName!: string;
  @ApiProperty({ nullable: true, type: Number }) age!: number | null;
  @ApiProperty({ nullable: true, type: String }) medicalConditions!: string | null;
  @ApiProperty({ nullable: true, type: String }) allergies!: string | null;
  @ApiProperty({ nullable: true, type: String }) currentMedications!: string | null;
  @ApiProperty({ type: [DoctorPatientAppointmentDto] }) appointmentsWithDoctor!: DoctorPatientAppointmentDto[];
  @ApiProperty({ type: [RecordListItemDto] }) completedConsultations!: RecordListItemDto[];
}
