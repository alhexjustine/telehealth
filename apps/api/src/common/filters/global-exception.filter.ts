import {
  ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { PinoLogger } from 'nestjs-pino';
import { REQUEST_ID_HEADER } from '../middleware/request-id.middleware.js';
import { Prisma } from '../../generated/prisma/client.js';
import { EXCLUSION_CONSTRAINT_SQLSTATE, postgresErrorCode } from '../errors/postgres-error.js';

interface ErrorBody {
  statusCode: number;
  error: string;
  message: string;
  requestId: string;
  /** Field-indexed validation details, when the exception payload carried them (see `resolve`). */
  errors?: unknown;
  /** Stable machine-readable code for a business-rule violation (see `DomainError`). */
  code?: string;
  /** Extra structured detail for some codes, e.g. the appointments a schedule change would orphan. */
  details?: unknown;
}

const UNIQUE_CONSTRAINT_VIOLATION = 'P2002';
const RECORD_NOT_FOUND = 'P2025';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(GlobalExceptionFilter.name);
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();
    const requestId = (request.headers[REQUEST_ID_HEADER] as string) ?? '';

    const resolved = this.resolve(exception);
    const body: ErrorBody = { ...resolved, requestId };

    if (resolved.statusCode >= 500) {
      this.logger.error({ err: exception, requestId }, resolved.message);
    }

    response.status(resolved.statusCode).json(body);
  }

  private resolve(exception: unknown): {
    statusCode: number;
    error: string;
    message: string;
    errors?: unknown;
    code?: string;
    details?: unknown;
  } {
    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const payload = exception.getResponse();
      const rawMessage =
        typeof payload === 'string'
          ? payload
          : ((payload as { message?: string | string[] }).message ?? exception.message);
      // A handler can throw `new BadRequestException({ message, errors })` to attach
      // field-indexed validation details (e.g. the availability schedule validator);
      // passed through as-is so the client can highlight the offending fields.
      const errors =
        typeof payload === 'object' && payload !== null && 'errors' in payload
          ? (payload as { errors?: unknown }).errors
          : undefined;
      // `DomainError` attaches a stable `code` (and, for some codes, `details`)
      // the same way; copied through only when present and well-formed so an
      // arbitrary `HttpException({ code: 123 })` can't forge a fake code.
      const rawCode =
        typeof payload === 'object' && payload !== null && 'code' in payload
          ? (payload as { code?: unknown }).code
          : undefined;
      const details =
        typeof payload === 'object' && payload !== null && 'details' in payload
          ? (payload as { details?: unknown }).details
          : undefined;
      return {
        statusCode,
        error: statusText(statusCode),
        message: Array.isArray(rawMessage) ? rawMessage.join(', ') : rawMessage,
        ...(errors !== undefined ? { errors } : {}),
        ...(typeof rawCode === 'string' ? { code: rawCode } : {}),
        ...(details !== undefined ? { details } : {}),
      };
    }

    if (isUniqueConstraintViolation(exception)) {
      return {
        statusCode: HttpStatus.CONFLICT,
        error: statusText(HttpStatus.CONFLICT),
        message: 'A record with this value already exists.',
      };
    }

    if (isRecordNotFound(exception)) {
      return {
        statusCode: HttpStatus.NOT_FOUND,
        error: statusText(HttpStatus.NOT_FOUND),
        message: 'The requested record was not found.',
      };
    }

    if (isExclusionConstraintViolation(exception)) {
      return {
        statusCode: HttpStatus.CONFLICT,
        error: statusText(HttpStatus.CONFLICT),
        message: 'This change conflicts with an existing record.',
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: statusText(HttpStatus.INTERNAL_SERVER_ERROR),
      message: 'An unexpected error occurred.',
    };
  }
}

function statusText(status: number): string {
  const key: string | undefined = HttpStatus[status];
  if (!key) return 'Error';
  return key
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
}

function isUniqueConstraintViolation(exception: unknown): boolean {
  return (
    exception instanceof Prisma.PrismaClientKnownRequestError &&
    exception.code === UNIQUE_CONSTRAINT_VIOLATION
  );
}

function isRecordNotFound(exception: unknown): boolean {
  return (
    exception instanceof Prisma.PrismaClientKnownRequestError && exception.code === RECORD_NOT_FOUND
  );
}

/**
 * A PostgreSQL exclusion-constraint violation (used for appointment-overlap
 * prevention). The appointments service catches this itself and rethrows a
 * `DomainError` with `SLOT_UNAVAILABLE`/`PATIENT_CONFLICT` so the response
 * carries a stable code (see `postgres-error.ts`); this filter's generic 409
 * is the fallback for any exclusion violation that reaches it uncaught.
 * Checked three ways for robustness: the real shape confirmed live
 * (`meta.driverAdapterError.cause.code`, via `postgresErrorCode`), and two
 * defensive fallbacks (`meta.code`, and the SQLSTATE attached directly to
 * the thrown error) in case a different Prisma/adapter version surfaces it
 * differently.
 */
function isExclusionConstraintViolation(exception: unknown): boolean {
  if (postgresErrorCode(exception) === EXCLUSION_CONSTRAINT_SQLSTATE) return true;
  if (exception instanceof Prisma.PrismaClientKnownRequestError) {
    const meta = exception.meta;
    if (meta?.code === EXCLUSION_CONSTRAINT_SQLSTATE) return true;
  }
  const code = (exception as { code?: unknown } | null | undefined)?.code;
  return code === EXCLUSION_CONSTRAINT_SQLSTATE;
}
