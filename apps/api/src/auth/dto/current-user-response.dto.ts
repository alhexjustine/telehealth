import { ApiProperty } from '@nestjs/swagger';
import { AccountStatus, Role, VerificationStatus } from '../../generated/prisma/enums.js';

/**
 * Returned by GET /auth/me. Role-specific fields are optional and only one of
 * them is populated, depending on `role`.
 */
export class CurrentUserResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() email!: string;
  @ApiProperty({ enum: Role }) role!: Role;
  @ApiProperty({ enum: AccountStatus }) status!: AccountStatus;
  @ApiProperty() displayName!: string;
  @ApiProperty({ required: false, description: 'Present only for PATIENT' })
  profileComplete?: boolean;
  @ApiProperty({ enum: VerificationStatus, required: false, description: 'Present only for DOCTOR' })
  verificationStatus?: VerificationStatus;
}
