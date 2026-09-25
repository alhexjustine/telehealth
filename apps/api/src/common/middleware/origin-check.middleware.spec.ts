import { describe, expect, it, jest } from '@jest/globals';
import type { Request, Response } from 'express';
import { createOriginCheckMiddleware } from './origin-check.middleware.js';

function makeRequest(method: string, origin?: string): Request {
  return { method, headers: origin === undefined ? {} : { origin } } as unknown as Request;
}

describe('createOriginCheckMiddleware', () => {
  const middleware = createOriginCheckMiddleware(['http://localhost:8080']);

  it('passes safe methods regardless of origin', () => {
    const next = jest.fn();
    middleware(makeRequest('GET', 'https://evil.example'), {} as Response, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('passes state-changing requests with no Origin header', () => {
    const next = jest.fn();
    middleware(makeRequest('POST'), {} as Response, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('passes state-changing requests from an allowed origin', () => {
    const next = jest.fn();
    middleware(makeRequest('POST', 'http://localhost:8080'), {} as Response, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('rejects state-changing requests from a foreign origin', () => {
    const next = jest.fn();
    middleware(makeRequest('POST', 'https://evil.example'), {} as Response, next);
    expect(next).toHaveBeenCalledTimes(1);
    const error = next.mock.calls[0]?.[0] as { getStatus(): number };
    expect(error.getStatus()).toBe(403);
  });
});
