import { describe, expect, it } from 'vitest';
import { landingContent } from './landing';

describe('landingContent.trust', () => {
  it('lists the six protections the application actually implements', () => {
    const { protections } = landingContent.trust;
    expect(protections).toHaveLength(6);

    const text = protections.map((p) => `${p.title} ${p.description}`.toLowerCase()).join(' | ');
    expect(text).toContain('argon2id');
    expect(text).toMatch(/session/);
    expect(text).toMatch(/role-based access/);
    expect(text).toMatch(/no admin access to clinical notes/);
    expect(text).toMatch(/audit log/);
    expect(text).toMatch(/no third-party services/);
  });
});
