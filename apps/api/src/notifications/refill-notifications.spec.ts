import { describe, expect, it } from '@jest/globals';
import { NotificationType } from '../generated/prisma/enums.js';
import { refillDecidedNotificationDraft, refillRequestedNotificationDraft } from './refill-notifications.js';

describe('refillRequestedNotificationDraft', () => {
  it('notifies the doctor, naming the requester', () => {
    const draft = refillRequestedNotificationDraft({
      appointmentId: 'appt-1',
      doctorId: 'doctor-1',
      requesterName: 'Ada Lovelace',
    });

    expect(draft.userId).toBe('doctor-1');
    expect(draft.type).toBe(NotificationType.REFILL_REQUESTED);
    expect(draft.title).toBe('Refill requested');
    expect(draft.body).toContain('Ada Lovelace');
    expect(draft.link).toBe('/doctor/refill-requests');
    expect(draft.appointmentId).toBe('appt-1');
  });

  it('names the dependent when the request is for one', () => {
    const draft = refillRequestedNotificationDraft({
      appointmentId: 'appt-1',
      doctorId: 'doctor-1',
      requesterName: 'Jamie Lovelace',
    });

    expect(draft.body).toContain('Jamie Lovelace');
  });
});

describe('refillDecidedNotificationDraft', () => {
  it('notifies the requesting account of an approval, including the note', () => {
    const draft = refillDecidedNotificationDraft({
      appointmentId: 'appt-1',
      requestedById: 'patient-1',
      approved: true,
      doctorNote: 'Renewed for another 30 days',
    });

    expect(draft.userId).toBe('patient-1');
    expect(draft.type).toBe(NotificationType.REFILL_DECIDED);
    expect(draft.title).toBe('Refill request approved');
    expect(draft.body).toContain('Renewed for another 30 days');
    expect(draft.data).toMatchObject({ doctorNote: 'Renewed for another 30 days' });
    expect(draft.link).toBe('/patient/records/appt-1');
  });

  it('notifies the requesting account of a denial, with no note', () => {
    const draft = refillDecidedNotificationDraft({
      appointmentId: 'appt-1',
      requestedById: 'patient-1',
      approved: false,
    });

    expect(draft.title).toBe('Refill request denied');
    expect(draft.body).toBe('Refill request denied');
    expect(draft.data).toBeUndefined();
  });
});
