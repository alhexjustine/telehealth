import { ApiProperty } from '@nestjs/swagger';
import { DoctorSearchResultDto } from '../../discovery/dto/doctor-search-result.dto.js';

export class FavoriteResponseDto {
  @ApiProperty() doctorId!: string;
  @ApiProperty({ type: String, format: 'date-time' }) favoritedAt!: string;
}

export class FavoriteDoctorSummaryDto extends DoctorSearchResultDto {
  @ApiProperty({ type: String, format: 'date-time' }) favoritedAt!: string;
}

export class FavoriteListResponseDto {
  @ApiProperty({ type: [FavoriteDoctorSummaryDto] }) items!: FavoriteDoctorSummaryDto[];
}
