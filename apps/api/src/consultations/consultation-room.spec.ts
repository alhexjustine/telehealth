import { describe, expect, it } from '@jest/globals';
import { consultationRoomId } from './consultation-room.js';

describe('consultationRoomId', () => {
  it('is deterministic for the same appointment ID and secret', () => {
    const a = consultationRoomId('apt-1', 'secret-a');
    const b = consultationRoomId('apt-1', 'secret-a');
    expect(a).toBe(b);
  });

  it('Room identifier is not guessable from the appointment ID', () => {
    // Not equal to the raw appointment ID, and not computable without the server secret.
    expect(consultationRoomId('apt-1', 'secret-a')).not.toBe('apt-1');
    const a = consultationRoomId('apt-1', 'secret-a');
    const b = consultationRoomId('apt-1', 'secret-b');
    expect(a).not.toBe(b);
  });

  it('changes if the appointment ID changes', () => {
    const a = consultationRoomId('apt-1', 'secret-a');
    const b = consultationRoomId('apt-2', 'secret-a');
    expect(a).not.toBe(b);
  });
});
