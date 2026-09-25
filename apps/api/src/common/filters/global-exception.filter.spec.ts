import { describe, expect, it, jest } from '@jest/globals';
import { ArgumentsHost, HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import type { PinoLogger } from 'nestjs-pino';
import { Prisma } from '../../generated/prisma/client.js';
import { GlobalExceptionFilter } from './global-exception.filter.js';

function createHost(requestId = 'req-1') {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const response = { status };
  const request = { headers: { 'x-request-id': requestId } };
  const host = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

function createLogger(): PinoLogger {
  return { setContext: jest.fn(), error: jest.fn() } as unknown as PinoLogger;
}

describe('GlobalExceptionFilter', () => {
  it('Constraint violation: unique constraint (P2002) maps to 409', () => {
    const filter = new GlobalExceptionFilter(createLogger());
    const { host, status, json } = createHost();
    const error = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '7.10.0',
    });

    filter.catch(error, host);

    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 409, error: 'Conflict', requestId: 'req-1' }),
    );
  });

  it('Constraint violation: exclusion constraint (23P01) maps to 409', () => {
    const filter = new GlobalExceptionFilter(createLogger());
    const { host, status, json } = createHost();
    const error = new Prisma.PrismaClientKnownRequestError('Raw query failed', {
      code: 'P2010',
      clientVersion: '7.10.0',
      meta: { code: '23P01' },
    });

    filter.catch(error, host);

    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 409, error: 'Conflict' }),
    );
  });

  it('maps Prisma P2025 (record not found) to 404', () => {
    const filter = new GlobalExceptionFilter(createLogger());
    const { host, status, json } = createHost();
    const error = new Prisma.PrismaClientKnownRequestError('Record not found', {
      code: 'P2025',
      clientVersion: '7.10.0',
    });

    filter.catch(error, host);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 404, error: 'Not Found' }),
    );
  });

  it('passes through a thrown NestJS HttpException unchanged', () => {
    const filter = new GlobalExceptionFilter(createLogger());
    const { host, status, json } = createHost();

    filter.catch(new NotFoundException('nope'), host);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 404, message: 'nope' }),
    );
  });

  it('Unexpected server error: 500, no stack trace in body, logged with the request id', () => {
    const logger = createLogger();
    const filter = new GlobalExceptionFilter(logger);
    const { host, status, json } = createHost();

    filter.catch(new Error('boom, with a secret stack trace'), host);

    expect(status).toHaveBeenCalledWith(500);
    const body = json.mock.calls[0]?.[0];
    expect(body).toEqual({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'An unexpected error occurred.',
      requestId: 'req-1',
    });
    expect(JSON.stringify(body)).not.toContain('secret stack trace');
    expect(logger.error).toHaveBeenCalled();
  });

  it('still returns the standard body shape when the exception has no message', () => {
    const filter = new GlobalExceptionFilter(createLogger());
    const { host, json } = createHost();

    filter.catch(new HttpException('', HttpStatus.BAD_REQUEST), host);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 400, error: 'Bad Request' }),
    );
  });
});
