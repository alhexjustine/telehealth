import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SpecializationSummaryDto } from '../../doctors/dto/doctor-profile-response.dto.js';
import { AppointmentStatus } from '../../generated/prisma/enums.js';

export class AppointmentDoctorSummaryDto {
  @ApiProperty() id!: string;
  @ApiProperty() displayName!: string;
  @ApiProperty({ type: [SpecializationSummaryDto] }) specializations!: SpecializationSummaryDto[];
}

export class AppointmentPatientSummaryDto {
  @ApiProperty() id!: string;
  @ApiProperty() displayName!: string;
  @ApiProperty({ nullable: true, type: Number }) age!: number | null;
}

export class AppointmentSymptomSummaryDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
}

/** The response shape for booking, rescheduling, cancelling, and listing appointments. */
export class AppointmentResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty({ type: String, format: 'date-time' }) startsAt!: string;
  @ApiProperty({ type: String, format: 'date-time' }) endsAt!: string;
  @ApiProperty({ enum: AppointmentStatus }) status!: AppointmentStatus;
  @ApiProperty() reason!: string;
  @ApiProperty({ type: AppointmentDoctorSummaryDto }) doctor!: AppointmentDoctorSummaryDto;
  @ApiProperty({ type: AppointmentPatientSummaryDto }) patient!: AppointmentPatientSummaryDto;
  @ApiProperty({ type: [AppointmentSymptomSummaryDto] }) symptoms!: AppointmentSymptomSummaryDto[];
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) cancelledAt!: string | null;
  @ApiProperty({ nullable: true, type: String }) cancellationReason!: string | null;
  @ApiProperty({ enum: ['PATIENT', 'DOCTOR'], nullable: true }) cancelledByRole!: 'PATIENT' | 'DOCTOR' | null;
  @ApiPropertyOptional({ nullable: true, type: String, description: 'The appointment this one replaced, if any' })
  rescheduledFromId?: string | null;
}

export class AppointmentListResponseDto {
  @ApiProperty({ type: [AppointmentResponseDto] }) items!: AppointmentResponseDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
}

export class AppointmentHistoryEntryDto {
  @ApiProperty() id!: string;
  @ApiProperty({ type: String, format: 'date-time' }) startsAt!: string;
  @ApiProperty({ type: String, format: 'date-time' }) endsAt!: string;
  @ApiProperty({ enum: AppointmentStatus }) status!: AppointmentStatus;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) cancelledAt!: string | null;
  @ApiProperty({ nullable: true, type: String }) cancellationReason!: string | null;
}

export class AppointmentDetailResponseDto extends AppointmentResponseDto {
  @ApiPropertyOptional({ nullable: true, type: String, description: 'The appointment this one was rescheduled into, if any' })
  rescheduledToId?: string | null;
  @ApiProperty({ type: [AppointmentHistoryEntryDto], description: 'The full reschedule/cancellation chain, chronological' })
  history!: AppointmentHistoryEntryDto[];
}
