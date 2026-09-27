import { ApiProperty } from '@nestjs/swagger';
import { VerificationStatus } from '../../generated/prisma/enums.js';

export class SpecializationSummaryDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
}

export class DoctorProfileResponseDto {
  @ApiProperty() firstName!: string;
  @ApiProperty() lastName!: string;
  @ApiProperty({ nullable: true, type: String }) bio!: string | null;
  @ApiProperty({ nullable: true, type: Number }) yearsOfExperience!: number | null;
  @ApiProperty() licenseNumber!: string;
  @ApiProperty() consultationMinutes!: number;
  @ApiProperty() acceptingBookings!: boolean;
  @ApiProperty({ enum: VerificationStatus }) verificationStatus!: VerificationStatus;
  @ApiProperty({ nullable: true, type: String }) reviewNote!: string | null;
  @ApiProperty({ type: [SpecializationSummaryDto] }) specializations!: SpecializationSummaryDto[];
}
