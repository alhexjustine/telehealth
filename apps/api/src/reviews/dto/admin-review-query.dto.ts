import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

/**
 * A boolean query param must read `obj` here, not `value`: with the global
 * `ValidationPipe`'s `enableImplicitConversion: true`, class-transformer
 * coerces the raw value via `Boolean(rawString)` (any non-empty string, so
 * `"false"` -> `true`) *before* this `@Transform` callback runs, so `value`
 * arrives already corrupted — `obj` is still the untouched source object.
 * Same fix already used by `notifications/dto/notification-list-query.dto.ts`'s
 * `unreadOnly`.
 */
function toBooleanQueryParam(obj: Record<string, unknown>, key: string): boolean | undefined {
  if (obj[key] === undefined) return undefined;
  return obj[key] === true || obj[key] === 'true';
}

export const DEFAULT_ADMIN_REVIEW_PAGE_SIZE = 20;
export const MAX_ADMIN_REVIEW_PAGE_SIZE = 100;

export class AdminReviewListQueryDto {
  @ApiPropertyOptional({ description: 'Filter to one doctor' })
  @IsOptional()
  @IsUUID('4')
  doctorId?: string;

  @ApiPropertyOptional({ description: "Matches the doctor's first or last name, case-insensitive" })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  doctorName?: string;

  @ApiPropertyOptional({ description: 'Filter by hidden status; omit for both' })
  @IsOptional()
  @Transform(({ obj }: { obj: Record<string, unknown> }) => toBooleanQueryParam(obj, 'hidden'))
  @IsBoolean()
  hidden?: boolean;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: MAX_ADMIN_REVIEW_PAGE_SIZE, default: DEFAULT_ADMIN_REVIEW_PAGE_SIZE })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_ADMIN_REVIEW_PAGE_SIZE)
  pageSize?: number;
}
