import { ApiProperty } from '@nestjs/swagger';

/** Never includes `keywords` or specialization weights — those stay server-side. */
export class SymptomSummaryDto {
  @ApiProperty() id!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() name!: string;
  @ApiProperty() category!: string;
  @ApiProperty() isRedFlag!: boolean;
}

export class SymptomCategoryDto {
  @ApiProperty() category!: string;
  @ApiProperty({ type: [SymptomSummaryDto] }) symptoms!: SymptomSummaryDto[];
}
