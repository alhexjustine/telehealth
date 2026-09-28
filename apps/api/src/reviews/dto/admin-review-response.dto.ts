import { ApiProperty } from '@nestjs/swagger';

/**
 * A review as seen by an administrator: includes hide/unhide state and the
 * reviewing account's opaque id (for correlating multiple reviews from the
 * same patient during moderation), but never the reviewer's name — the
 * patient stays anonymous to admins and doctors alike, same as the public
 * view. See design.md's "Reviewer identity is never shown, to anyone,
 * only the reviewing account's id is retained for moderation".
 */
export class AdminReviewDto {
  @ApiProperty() id!: string;
  @ApiProperty() appointmentId!: string;
  @ApiProperty() doctorId!: string;
  @ApiProperty() doctorDisplayName!: string;
  @ApiProperty({ description: 'Opaque id of the reviewing account; never a name' }) patientId!: string;
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
