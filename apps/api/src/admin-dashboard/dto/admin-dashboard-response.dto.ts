import { ApiProperty } from '@nestjs/swagger';

export class AccountStatusCountsDto {
  @ApiProperty() ACTIVE!: number;
  @ApiProperty() SUSPENDED!: number;
  @ApiProperty() DEACTIVATED!: number;
}

export class DoctorVerificationCountsDto {
  @ApiProperty() PENDING!: number;
  @ApiProperty() APPROVED!: number;
  @ApiProperty() REJECTED!: number;
}

export class AppointmentStatusCountsDto {
  @ApiProperty() BOOKED!: number;
  @ApiProperty() CANCELLED!: number;
  @ApiProperty() COMPLETED!: number;
  @ApiProperty() NOT_HELD!: number;
}

export class DashboardTrendBucketDto {
  @ApiProperty({ description: 'YYYY-MM-DD, local calendar date in the requested time zone' }) date!: string;
  @ApiProperty() count!: number;
  @ApiProperty() isToday!: boolean;
}

export class AdminDashboardResponseDto {
  @ApiProperty({ type: AccountStatusCountsDto }) patients!: AccountStatusCountsDto;
  @ApiProperty({ type: AccountStatusCountsDto }) doctors!: AccountStatusCountsDto;
  @ApiProperty({ type: DoctorVerificationCountsDto }) doctorVerification!: DoctorVerificationCountsDto;
  @ApiProperty({ type: AppointmentStatusCountsDto }) appointmentsToday!: AppointmentStatusCountsDto;
  @ApiProperty({ type: AppointmentStatusCountsDto }) appointmentsUpcoming!: AppointmentStatusCountsDto;
  @ApiProperty({ type: AppointmentStatusCountsDto }) appointmentsAllTime!: AppointmentStatusCountsDto;
  @ApiProperty() consultationsInProgress!: number;
  @ApiProperty() consultationsCompletedToday!: number;
  @ApiProperty() consultationsCompletedLast7Days!: number;
  @ApiProperty() pendingDoctorReviews!: number;
  @ApiProperty() invalidBookings!: number;
  @ApiProperty({ type: [DashboardTrendBucketDto] }) trend!: DashboardTrendBucketDto[];
  @ApiProperty() timezone!: string;
}
