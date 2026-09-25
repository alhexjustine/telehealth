import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsInt, IsString, Max, Min, ValidateNested } from 'class-validator';

export class AvailabilityRuleDto {
  @ApiProperty({ minimum: 1, maximum: 7, description: 'ISO weekday: Monday = 1, Sunday = 7' })
  @IsInt()
  @Min(1)
  @Max(7)
  weekday!: number;

  @ApiProperty({ minimum: 0, maximum: 1440, description: 'Minutes since local midnight' })
  @IsInt()
  @Min(0)
  @Max(1440)
  startMinute!: number;

  @ApiProperty({ minimum: 0, maximum: 1440, description: 'Minutes since local midnight' })
  @IsInt()
  @Min(0)
  @Max(1440)
  endMinute!: number;
}

export class SaveAvailabilityDto {
  @ApiProperty({ description: 'IANA time zone, e.g. Asia/Manila' })
  @IsString()
  timezone!: string;

  @ApiProperty({ type: [AvailabilityRuleDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AvailabilityRuleDto)
  rules!: AvailabilityRuleDto[];
}
