import { ApiProperty } from '@nestjs/swagger';
import { AccountStatus, Role } from '../../generated/prisma/enums.js';

/**
 * Built from an explicit allow-list of fields (no clinical or credential
 * data exists on `User` to leak, but the pattern is kept consistent with
 * the other admin DTOs — see design.md's "Admin appointment DTOs are built
 * from an explicit allow-list").
 */
export class AdminUserResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() email!: string;
  @ApiProperty({ enum: Role }) role!: Role;
  @ApiProperty({ enum: AccountStatus }) status!: AccountStatus;
  @ApiProperty({ nullable: true, type: String }) statusReason!: string | null;
  @ApiProperty() displayName!: string;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: string;
  @ApiProperty({ nullable: true, type: String, format: 'date-time' }) lastLoginAt!: string | null;
  @ApiProperty({ description: 'Number of upcoming BOOKED appointments' }) upcomingAppointmentCount!: number;
}

export class AdminUserListResponseDto {
  @ApiProperty({ type: [AdminUserResponseDto] }) items!: AdminUserResponseDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
}
