import { ApiProperty } from '@nestjs/swagger';

export class SpecializationResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() name!: string;
  @ApiProperty() description!: string;
}
