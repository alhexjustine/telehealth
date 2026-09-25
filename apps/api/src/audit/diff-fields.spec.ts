import { describe, expect, it } from '@jest/globals';
import { diffFields } from './diff-fields.js';

interface FakeUser {
  status: string;
  statusReason: string | null;
  passwordHash: string;
  email: string;
}

describe('diffFields', () => {
  it('Only changed allow-listed fields are included', () => {
    const before: FakeUser = { status: 'ACTIVE', statusReason: null, passwordHash: 'a', email: 'x@example.com' };
    const after: FakeUser = { status: 'SUSPENDED', statusReason: 'Abuse', passwordHash: 'a', email: 'x@example.com' };

    const diff = diffFields(before, after, ['status', 'statusReason']);

    expect(diff).toEqual({
      before: { status: 'ACTIVE', statusReason: null },
      after: { status: 'SUSPENDED', statusReason: 'Abuse' },
    });
  });

  it('Unlisted fields are never read, even when present and changed', () => {
    const before: FakeUser = { status: 'ACTIVE', statusReason: null, passwordHash: 'old-hash', email: 'a@example.com' };
    const after: FakeUser = { status: 'ACTIVE', statusReason: null, passwordHash: 'new-hash', email: 'b@example.com' };

    const diff = diffFields(before, after, ['status', 'statusReason']);

    expect(diff.before).not.toHaveProperty('passwordHash');
    expect(diff.after).not.toHaveProperty('passwordHash');
    expect(diff.before).not.toHaveProperty('email');
    expect(diff.after).not.toHaveProperty('email');
    expect(diff).toEqual({ before: {}, after: {} });
  });

  it('Unchanged fields are omitted', () => {
    const before = { a: 1, b: 'same' };
    const after = { a: 2, b: 'same' };

    const diff = diffFields(before, after, ['a', 'b']);

    expect(diff).toEqual({ before: { a: 1 }, after: { a: 2 } });
  });

  it('Array fields compare by value, not by reference', () => {
    const before = { ids: ['1', '2'] };
    const afterSame = { ids: ['1', '2'] };
    const afterChanged = { ids: ['1', '3'] };

    expect(diffFields(before, afterSame, ['ids'])).toEqual({ before: {}, after: {} });
    expect(diffFields(before, afterChanged, ['ids'])).toEqual({
      before: { ids: ['1', '2'] },
      after: { ids: ['1', '3'] },
    });
  });

  it('Missing values are treated as null', () => {
    const diff = diffFields({}, { status: 'SUSPENDED' }, ['status']);
    expect(diff).toEqual({ before: { status: null }, after: { status: 'SUSPENDED' } });
  });

  it('Dates are compared by instant and serialized to ISO strings', () => {
    const before = { at: new Date('2026-01-01T00:00:00.000Z') };
    const after = { at: new Date('2026-01-02T00:00:00.000Z') };

    expect(diffFields(before, before, ['at'])).toEqual({ before: {}, after: {} });
    expect(diffFields(before, after, ['at'])).toEqual({
      before: { at: '2026-01-01T00:00:00.000Z' },
      after: { at: '2026-01-02T00:00:00.000Z' },
    });
  });
});
