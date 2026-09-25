import { ApiProperty } from '@nestjs/swagger';

export class SlotResponseDto {
  @ApiProperty({ type: String, format: 'date-time' }) start!: string;
  @ApiProperty({ type: String, format: 'date-time' }) end!: string;
}
