import { ApiProperty } from '@nestjs/swagger';

/**
 * A review as seen by an administrator: includes the reviewing account and
 * hide/unhide state, unlike the public view — see design.md's "Reviewer
 * identity is never shown in the public/patient-facing view, only to
 * admins."
 */
export class AdminReviewDto {
  @ApiProperty() id!: string;
  @ApiProperty() appointmentId!: string;
  @ApiProperty() doctorId!: string;
  @ApiProperty() doctorDisplayName!: string;
  @ApiProperty() patientId!: string;
  @ApiProperty() patientDisplayName!: string;
  @ApiProperty() rating!: number;
  @ApiProperty({ nullable: true, type: String }) comment!: string | null;
  @ApiProperty() hidden!: boolean;
  @ApiProperty({ nullable: true, type: String }) hiddenReason!: string | null;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: string;
}

export class AdminReviewListResponseDto {
  @ApiProperty({ type: [AdminReviewDto] }) items!: AdminReviewDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
}
