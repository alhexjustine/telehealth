import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export const DEFAULT_RECORD_PAGE_SIZE = 20;
export const MAX_RECORD_PAGE_SIZE = 50;

export class RecordListQueryDto {
  @ApiPropertyOptional({
    description:
      'Filters the list to one person: "self" for the account holder, or a dependent\'s ID. Omit to list everyone on the account.',
  })
  @IsOptional()
  @IsString()
  dependentId?: string;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: MAX_RECORD_PAGE_SIZE, default: DEFAULT_RECORD_PAGE_SIZE })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_RECORD_PAGE_SIZE)
  pageSize?: number;
}

export class DoctorPatientRecordQueryDto {
  @ApiPropertyOptional({ description: "One of the patient's dependents; omit for the account holder's own record" })
  @IsOptional()
  @IsUUID('4')
  dependentId?: string;
}
