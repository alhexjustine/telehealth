import { ApiProperty } from '@nestjs/swagger';

export class AvailabilityRuleResponseDto {
  @ApiProperty({ minimum: 1, maximum: 7 }) weekday!: number;
  @ApiProperty({ minimum: 0, maximum: 1440 }) startMinute!: number;
  @ApiProperty({ minimum: 0, maximum: 1440 }) endMinute!: number;
}

export class TimeOffResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty({ type: String, format: 'date-time' }) startsAt!: string;
  @ApiProperty({ type: String, format: 'date-time' }) endsAt!: string;
  @ApiProperty({ nullable: true, type: String }) reason!: string | null;
}

export class AvailabilityResponseDto {
  @ApiProperty({ description: 'IANA time zone' }) timezone!: string;
  @ApiProperty({ type: [AvailabilityRuleResponseDto] }) rules!: AvailabilityRuleResponseDto[];
  @ApiProperty({ type: [TimeOffResponseDto], description: 'Time off that ends in the future' })
  timeOff!: TimeOffResponseDto[];
}
