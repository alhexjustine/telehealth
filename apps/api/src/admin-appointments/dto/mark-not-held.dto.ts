import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class MarkNotHeldDto {
  @ApiProperty({ minLength: 5, maxLength: 500 })
  @IsString()
  @Length(5, 500)
  reason!: string;
}
