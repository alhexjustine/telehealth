import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';

export class ApproveDoctorDto {
  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  note?: string;
}

export class RejectDoctorDto {
  @ApiPropertyOptional({ minLength: 5, maxLength: 1000 })
  @IsString()
  @Length(5, 1000)
  note!: string;
}
