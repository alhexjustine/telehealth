import { ApiProperty } from '@nestjs/swagger';
import { SpecializationSummaryDto } from '../../doctors/dto/doctor-profile-response.dto.js';

export class DoctorSearchResultDto {
  @ApiProperty() id!: string;
  @ApiProperty() displayName!: string;
  @ApiProperty({ type: [SpecializationSummaryDto] }) specializations!: SpecializationSummaryDto[];
  @ApiProperty({ nullable: true, type: String, maxLength: 200 }) bioExcerpt!: string | null;
  @ApiProperty({ nullable: true, type: Number }) yearsOfExperience!: number | null;
  @ApiProperty() consultationMinutes!: number;
  @ApiProperty() acceptingBookings!: boolean;
  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  nextAvailableSlot!: string | null;
  @ApiProperty({ nullable: true, type: Number, description: 'Average of visible reviews only, rounded to 1 decimal; absent if there are none' })
  averageRating!: number | null;
  @ApiProperty({ description: 'Count of visible reviews only' }) reviewCount!: number;
}

export class DoctorSearchResponseDto {
  @ApiProperty({ type: [DoctorSearchResultDto] }) items!: DoctorSearchResultDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
}
