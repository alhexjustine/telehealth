import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsEmail, IsString, IsUUID, Length, Matches } from 'class-validator';
import { IsPasswordPolicy } from '../password/password-policy.decorator.js';
import { LICENSE_NUMBER_PATTERN } from '../../doctors/license-number.js';

export class RegisterDoctorDto {
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

  @ApiProperty({ type: [String], description: 'At least one specialization ID from the catalog' })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  specializationIds!: string[];

  @ApiProperty({ description: '4-32 letters, digits, or dashes' })
  @IsString()
  @Matches(LICENSE_NUMBER_PATTERN)
  licenseNumber!: string;
}
