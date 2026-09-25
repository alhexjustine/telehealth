import { ApiProperty } from '@nestjs/swagger';
import { SpecializationSummaryDto } from '../../doctors/dto/doctor-profile-response.dto.js';
import { AccountStatus, VerificationStatus } from '../../generated/prisma/enums.js';

/** Built from an explicit allow-list of fields — no clinical content exists on a doctor profile. */
export class AdminDoctorListItemDto {
  @ApiProperty() id!: string;
  @ApiProperty() displayName!: string;
  @ApiProperty() email!: string;
  @ApiProperty() licenseNumber!: string;
  @ApiProperty({ enum: VerificationStatus }) verificationStatus!: VerificationStatus;
  @ApiProperty({ enum: AccountStatus }) accountStatus!: AccountStatus;
  @ApiProperty({ type: [SpecializationSummaryDto] }) specializations!: SpecializationSummaryDto[];
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt!: string;
}

export class AdminDoctorListResponseDto {
  @ApiProperty({ type: [AdminDoctorListItemDto] }) items!: AdminDoctorListItemDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
}

/** The full profile for review, including email and license number. */
export class AdminDoctorProfileDto {
  @ApiProperty() id!: string;
  @ApiProperty() email!: string;
  @ApiProperty() firstName!: string;
  @ApiProperty() lastName!: string;
  @ApiProperty({ nullable: true, type: String }) bio!: string | null;
  @ApiProperty({ nullable: true, type: Number }) yearsOfExperience!: number | null;
  @ApiProperty() licenseNumber!: string;
  @ApiProperty() consultationMinutes!: number;
  @ApiProperty({ enum: VerificationStatus }) verificationStatus!: VerificationStatus;
  @ApiProperty({ nullable: true, type: String }) reviewNote!: string | null;
  @ApiProperty({ enum: AccountStatus }) accountStatus!: AccountStatus;
  @ApiProperty({ nullable: true, type: String }) accountStatusReason!: string | null;
  @ApiProperty({ type: [SpecializationSummaryDto] }) specializations!: SpecializationSummaryDto[];
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt!: string;
}
