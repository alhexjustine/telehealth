import { describe, expect, it } from 'vitest';
import { consumeSessionEnded, markSessionEnded } from './session-ended';

describe('session-ended', () => {
  it('reports and clears the flag in one read', () => {
    markSessionEnded();

    expect(consumeSessionEnded()).toBe(true);
    expect(consumeSessionEnded()).toBe(false);
  });

  it('is false when never marked', () => {
    expect(consumeSessionEnded()).toBe(false);
  });
});
