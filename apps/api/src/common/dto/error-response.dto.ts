import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * The shape every API error response takes (`GlobalExceptionFilter`).
 * Referenced from error responses via `@ApiResponse({ type: ErrorResponseDto })`
 * so Swagger documents the optional `code`/`details`/`errors` fields instead
 * of readers having to infer them from examples.
 */
export class ErrorResponseDto {
  @ApiProperty() statusCode!: number;
  @ApiProperty() error!: string;
  @ApiProperty() message!: string;
  @ApiProperty() requestId!: string;
  @ApiPropertyOptional({
    description: 'Stable machine-readable code for a business-rule violation, e.g. SLOT_UNAVAILABLE.',
  })
  code?: string;
  @ApiPropertyOptional({
    description: 'Extra structured detail for some codes, e.g. the appointments a schedule change would orphan.',
    type: 'object',
    additionalProperties: true,
  })
  details?: unknown;
  @ApiPropertyOptional({
    description: 'Field-indexed validation errors, when the request failed validation.',
    type: 'array',
    items: { type: 'object', additionalProperties: true },
  })
  errors?: unknown;
}
