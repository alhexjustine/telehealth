import { ApiProperty } from '@nestjs/swagger';

/** The caller's own review of one of their appointments (patient-facing, write-path read-back). */
export class OwnReviewResponseDto {
  @ApiProperty() appointmentId!: string;
  @ApiProperty() rating!: number;
  @ApiProperty({ nullable: true, type: String }) comment!: string | null;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt!: string;
}

/** One review as shown in the public (patient-facing) list — never carries reviewer identity. */
export class PublicReviewDto {
  @ApiProperty() id!: string;
  @ApiProperty() rating!: number;
  @ApiProperty({ nullable: true, type: String }) comment!: string | null;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: string;
}

export class DoctorReviewListResponseDto {
  @ApiProperty({ type: [PublicReviewDto] }) items!: PublicReviewDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
  @ApiProperty({ nullable: true, type: Number, description: 'Average of visible reviews only, rounded to 1 decimal; absent (not zero) if there are none' })
  averageRating!: number | null;
  @ApiProperty({ description: 'Count of visible reviews only' }) reviewCount!: number;
}
