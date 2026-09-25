import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length } from 'class-validator';
import { IsPasswordPolicy } from '../password/password-policy.decorator.js';

export class RegisterPatientDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty({ description: '10-128 characters, must not equal the email' })
  @IsString()
  @IsPasswordPolicy()
  password!: string;

  @ApiProperty()
  @IsString()
  @Length(1, 100)
  firstName!: string;

  @ApiProperty()
  @IsString()
  @Length(1, 100)
  lastName!: string;
}
