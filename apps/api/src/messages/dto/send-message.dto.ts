import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export const MAX_MESSAGE_BODY_LENGTH = 2000;

export class SendMessageDto {
  @ApiProperty({ maxLength: MAX_MESSAGE_BODY_LENGTH, description: 'Trimmed before validation and storage' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_MESSAGE_BODY_LENGTH)
  body!: string;
}
