import { Prisma } from '../../generated/prisma/client.js';

/** The PostgreSQL SQLSTATE for an exclusion-constraint violation. */
export const EXCLUSION_CONSTRAINT_SQLSTATE = '23P01';

interface DriverAdapterErrorLike {
  cause?: { code?: string; message?: string };
}

/**
 * The raw PostgreSQL SQLSTATE behind a Prisma error thrown through
 * `@prisma/adapter-pg` (Prisma 7's driver-adapter architecture), or
 * `undefined` when the exception isn't a database error. Prisma's own
 * `PrismaClientKnownRequestError.code` (`P20xx`) identifies which Prisma
 * operation failed, not the underlying SQLSTATE — confirmed against a live
 * `23P01` exclusion-constraint violation, the real Postgres code lives three
 * levels down at `exception.meta.driverAdapterError.cause.code`. A raw
 * `$executeRaw` insert and a normal `.create()` call surface different
 * top-level Prisma codes for the same violation (`P2010` vs `P2039`), so
 * callers should match on this nested SQLSTATE, not on `exception.code`.
 */
export function postgresErrorCode(exception: unknown): string | undefined {
  if (!(exception instanceof Prisma.PrismaClientKnownRequestError)) return undefined;
  const driverAdapterError = (
    exception.meta as { driverAdapterError?: DriverAdapterErrorLike } | undefined
  )?.driverAdapterError;
  return driverAdapterError?.cause?.code;
}

/** The violated constraint's name, parsed from the underlying Postgres error message, when known. */
export function postgresConstraintName(exception: unknown): string | undefined {
  if (!(exception instanceof Prisma.PrismaClientKnownRequestError)) return undefined;
  const driverAdapterError = (
    exception.meta as { driverAdapterError?: DriverAdapterErrorLike } | undefined
  )?.driverAdapterError;
  const message = driverAdapterError?.cause?.message;
  return message?.match(/constraint "([^"]+)"/)?.[1];
}
