import { ApiProperty } from '@nestjs/swagger';
import { AppointmentStatus, SessionState } from '../../generated/prisma/enums.js';
import { InvalidBookingFlag } from '../invalid-booking.js';

export class AdminAppointmentParticipantDto {
  @ApiProperty() id!: string;
  @ApiProperty() displayName!: string;
}

/**
 * Built from an explicit allow-list of fields — see design.md's "Admin
 * appointment DTOs are built from an explicit allow-list". Deliberately
 * excludes `reason`, `symptoms`, and anything from `ConsultationNote`/
 * `Prescription`; `no-clinical-content.spec.ts` asserts none of those keys
 * ever appear on this shape.
 */
export class AdminAppointmentResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty({ type: String, format: 'date-time' }) startsAt!: string;
  @ApiProperty({ type: String, format: 'date-time' }) endsAt!: string;
  @ApiProperty({ enum: AppointmentStatus }) status!: AppointmentStatus;
  @ApiProperty({ type: AdminAppointmentParticipantDto }) doctor!: AdminAppointmentParticipantDto;
  @ApiProperty({ type: AdminAppointmentParticipantDto }) patient!: AdminAppointmentParticipantDto;
  @ApiProperty({ enum: SessionState }) consultationState!: SessionState;
  @ApiProperty({ enum: InvalidBookingFlag, isArray: true }) flags!: InvalidBookingFlag[];
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) cancelledAt!: string | null;
  @ApiProperty({ enum: ['PATIENT', 'DOCTOR', 'ADMIN'], nullable: true }) cancelledByRole!: 'PATIENT' | 'DOCTOR' | 'ADMIN' | null;
  @ApiProperty({ nullable: true, type: String }) cancellationReason!: string | null;
  @ApiProperty({ nullable: true, type: String }) resolutionReason!: string | null;
}

export class AdminAppointmentListResponseDto {
  @ApiProperty({ type: [AdminAppointmentResponseDto] }) items!: AdminAppointmentResponseDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
}
