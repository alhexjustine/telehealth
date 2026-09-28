import { ApiProperty } from '@nestjs/swagger';

export class PublicSpecializationDto {
  @ApiProperty() id!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() name!: string;
  @ApiProperty() description!: string;
}

/**
 * A doctor's profile as seen by another signed-in user (or by themselves).
 * Deliberately excludes email, license number, and review note.
 */
export class PublicDoctorProfileDto {
  @ApiProperty() id!: string;
  @ApiProperty() displayName!: string;
  @ApiProperty({ nullable: true, type: String }) bio!: string | null;
  @ApiProperty({ type: [PublicSpecializationDto] }) specializations!: PublicSpecializationDto[];
  @ApiProperty({ nullable: true, type: Number }) yearsOfExperience!: number | null;
  @ApiProperty() consultationMinutes!: number;
  @ApiProperty() timezone!: string;
  @ApiProperty() acceptingBookings!: boolean;
  @ApiProperty({ nullable: true, type: Number, description: 'Average of visible reviews only, rounded to 1 decimal; absent if there are none' })
  averageRating!: number | null;
  @ApiProperty({ description: 'Count of visible reviews only' }) reviewCount!: number;
}
