import { ApiProperty } from '@nestjs/swagger';
import { AppointmentStatus, DependentRelationship, SessionState } from '../../generated/prisma/enums.js';
import { InvalidBookingFlag } from '../invalid-booking.js';

export class AdminAppointmentParticipantDto {
  @ApiProperty() id!: string;
  @ApiProperty() displayName!: string;
}

/** Who the appointment is actually for, when it's a dependent — never the dependent's medical history. */
export class AdminAppointmentDependentDto {
  @ApiProperty() id!: string;
  @ApiProperty() displayName!: string;
  @ApiProperty({ enum: DependentRelationship }) relationship!: DependentRelationship;
}

/**
 * Built from an explicit allow-list of fields — see design.md's "Admin
 * appointment DTOs are built from an explicit allow-list". Deliberately
 * excludes `reason`, `symptoms`, and anything from `ConsultationNote`/
 * `Prescription`, plus `Message.body` (`add-consultation-messaging`'s
 * `messageCount`/`lastMessageAt` are metadata only) and a `Dependent`'s
 * medical-history fields (`add-dependent-booking`'s `dependent` is name +
 * relationship only); `admin-appointments.e2e-spec.ts`'s "No clinical
 * content" test asserts none of those keys ever appear on this shape.
 */
export class AdminAppointmentResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty({ type: String, format: 'date-time' }) startsAt!: string;
  @ApiProperty({ type: String, format: 'date-time' }) endsAt!: string;
  @ApiProperty({ enum: AppointmentStatus }) status!: AppointmentStatus;
  @ApiProperty({ type: AdminAppointmentParticipantDto }) doctor!: AdminAppointmentParticipantDto;
  @ApiProperty({ type: AdminAppointmentParticipantDto }) patient!: AdminAppointmentParticipantDto;
  @ApiProperty({
    type: AdminAppointmentDependentDto,
    nullable: true,
    description: "Set when the appointment is for one of the account holder's dependents, not the account holder themselves",
  })
  dependent!: AdminAppointmentDependentDto | null;
  @ApiProperty({ enum: SessionState }) consultationState!: SessionState;
  @ApiProperty({ enum: InvalidBookingFlag, isArray: true }) flags!: InvalidBookingFlag[];
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) cancelledAt!: string | null;
  @ApiProperty({ enum: ['PATIENT', 'DOCTOR', 'ADMIN'], nullable: true }) cancelledByRole!: 'PATIENT' | 'DOCTOR' | 'ADMIN' | null;
  @ApiProperty({ nullable: true, type: String }) cancellationReason!: string | null;
  @ApiProperty({ nullable: true, type: String }) resolutionReason!: string | null;
  @ApiProperty({ description: 'Number of messages exchanged on this appointment; never the message content' }) messageCount!: number;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) lastMessageAt!: string | null;
}

export class AdminAppointmentListResponseDto {
  @ApiProperty({ type: [AdminAppointmentResponseDto] }) items!: AdminAppointmentResponseDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
}
