import { ApiProperty } from '@nestjs/swagger';
import { RefillRequestStatus } from '../../generated/prisma/enums.js';
import { AppointmentDependentSummaryDto, AppointmentPatientSummaryDto } from '../../appointments/dto/appointment-response.dto.js';

/**
 * The refills module's own response shape for a refill request — richer than
 * `records`' embedded `RefillRequestDto`, since this one also drives the
 * doctor-facing queue (medication, who it's for, when the consultation was).
 */
export class RefillRequestResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() appointmentId!: string;
  @ApiProperty() prescriptionId!: string;
  @ApiProperty() medication!: string;
  @ApiProperty({ type: String, format: 'date-time' }) appointmentStartsAt!: string;
  @ApiProperty({ type: AppointmentPatientSummaryDto }) patient!: AppointmentPatientSummaryDto;
  @ApiProperty({
    type: AppointmentDependentSummaryDto,
    nullable: true,
    description: "Who the consultation was for, if not the account holder ('patient') themselves",
  })
  dependent!: AppointmentDependentSummaryDto | null;
  @ApiProperty({ enum: RefillRequestStatus }) status!: RefillRequestStatus;
  @ApiProperty({ nullable: true, type: String }) patientNote!: string | null;
  @ApiProperty({ nullable: true, type: String }) doctorNote!: string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) decidedAt!: string | null;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: string;
}

export class RefillRequestListResponseDto {
  @ApiProperty({ type: [RefillRequestResponseDto] }) items!: RefillRequestResponseDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
}
