import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class FavoriteDoctorDto {
  @ApiProperty()
  @IsUUID('4')
  doctorId!: string;
}
