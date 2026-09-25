import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';
import { IsPasswordPolicy } from '../password/password-policy.decorator.js';

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  currentPassword!: string;

  @ApiProperty({ description: '10-128 characters, must not equal the email' })
  @IsString()
  @IsPasswordPolicy()
  newPassword!: string;
}
