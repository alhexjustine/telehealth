import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export const DEFAULT_NOTIFICATION_PAGE_SIZE = 20;
export const MAX_NOTIFICATION_PAGE_SIZE = 50;

export class NotificationListQueryDto {
  // `@Type(() => Boolean)` (and this controller's global
  // `transformOptions.enableImplicitConversion`) coerce the query STRING
  // "false" to `true` (JS's `Boolean("false")` is truthy for any non-empty
  // string) — the same footgun `env.schema.ts` avoids with
  // `z.coerce.boolean()`. Worse: implicit conversion runs BEFORE this
  // `@Transform`, so reading `value` here would already see the corrupted
  // `true` — read the untouched raw string from `obj` instead. The frontend
  // always sends `unreadOnly=false` explicitly, so this silently forced
  // every list request into unread-only mode.
  @ApiPropertyOptional({ default: false, description: 'When true, only unread notifications are returned' })
  @IsOptional()
  @Transform(({ obj }: { obj: Record<string, unknown> }) => obj.unreadOnly === true || obj.unreadOnly === 'true')
  @IsBoolean()
  unreadOnly?: boolean;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: MAX_NOTIFICATION_PAGE_SIZE, default: DEFAULT_NOTIFICATION_PAGE_SIZE })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_NOTIFICATION_PAGE_SIZE)
  pageSize?: number;
}
