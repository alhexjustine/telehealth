import { describe, expect, it } from 'vitest';
import { sanitizeReturnTo } from './return-to';

describe('sanitizeReturnTo', () => {
  it('accepts a same-site path', () => {
    expect(sanitizeReturnTo('/patient/profile')).toBe('/patient/profile');
  });

  it('accepts a same-site path with query string', () => {
    expect(sanitizeReturnTo('/doctor?tab=notes')).toBe('/doctor?tab=notes');
  });

  it('rejects an empty or missing value', () => {
    expect(sanitizeReturnTo(null)).toBeNull();
    expect(sanitizeReturnTo(undefined)).toBeNull();
    expect(sanitizeReturnTo('')).toBeNull();
  });

  it('rejects a value not starting with a single slash', () => {
    expect(sanitizeReturnTo('patient/home')).toBeNull();
  });

  it('rejects a protocol-relative address', () => {
    expect(sanitizeReturnTo('//evil.example/steal')).toBeNull();
  });

  it('rejects an address carrying a scheme', () => {
    expect(sanitizeReturnTo('/redirect?to=https://evil.example')).toBeNull();
    expect(sanitizeReturnTo('https://evil.example')).toBeNull();
  });

  it('rejects backslash and control-character tricks that parse as protocol-relative', () => {
    expect(sanitizeReturnTo('/\\evil.example')).toBeNull();
    expect(sanitizeReturnTo('/\t/evil.example')).toBeNull();
    expect(sanitizeReturnTo('/%0a')).toBe('/%0a');
  });
});
