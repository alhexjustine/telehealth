import { HttpException, type HttpStatus } from '@nestjs/common';
import type { ErrorCode } from './error-codes.js';

/**
 * A business-rule violation: an `HttpException` whose response payload
 * carries a stable `code` (and, for rules that name the offending records,
 * `details`) that `GlobalExceptionFilter` copies onto the standard error
 * body. Use this instead of a bare `ConflictException`/`BadRequestException`
 * whenever the violation has (or should have) an entry in `ErrorCode`.
 */
export class DomainError extends HttpException {
  constructor(status: HttpStatus, code: ErrorCode, message: string, details?: unknown) {
    super({ message, code, ...(details !== undefined ? { details } : {}) }, status);
  }
}
