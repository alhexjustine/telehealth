import { ApiProperty } from '@nestjs/swagger';
import { SpecializationSummaryDto } from '../../doctors/dto/doctor-profile-response.dto.js';

export class DoctorSearchResultDto {
  @ApiProperty() id!: string;
  @ApiProperty() displayName!: string;
  @ApiProperty({ type: [SpecializationSummaryDto] }) specializations!: SpecializationSummaryDto[];
  @ApiProperty({ nullable: true, type: String, maxLength: 200 }) bioExcerpt!: string | null;
  @ApiProperty({ nullable: true, type: Number }) yearsOfExperience!: number | null;
  @ApiProperty() consultationMinutes!: number;
  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  nextAvailableSlot!: string | null;
}

export class DoctorSearchResponseDto {
  @ApiProperty({ type: [DoctorSearchResultDto] }) items!: DoctorSearchResultDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
}
