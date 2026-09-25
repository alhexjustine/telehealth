import { ApiProperty } from '@nestjs/swagger';

export class PatientProfileResponseDto {
  @ApiProperty() firstName!: string;
  @ApiProperty() lastName!: string;
  @ApiProperty({ nullable: true, type: String }) birthDate!: string | null;
  @ApiProperty({ nullable: true, type: Number }) weightKg!: number | null;
  @ApiProperty({ nullable: true, type: Number }) heightCm!: number | null;
  @ApiProperty({ nullable: true, type: String }) phone!: string | null;
  @ApiProperty({ nullable: true, type: String }) emergencyContactName!: string | null;
  @ApiProperty({ nullable: true, type: String }) emergencyContactPhone!: string | null;
  @ApiProperty({ nullable: true, type: String }) medicalConditions!: string | null;
  @ApiProperty({ nullable: true, type: String }) allergies!: string | null;
  @ApiProperty({ nullable: true, type: String }) currentMedications!: string | null;
  @ApiProperty() profileComplete!: boolean;
}
