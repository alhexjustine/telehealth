import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { createTestApp } from './support/test-app.js';
import { resetDatabase } from './support/reset-db.js';
import { createAndSignInAdmin, registerDoctor, registerPatient } from './support/auth-helpers.js';
import {
  createAppointmentDirect,
  nextSlotStart,
  registerBookableDoctor,
  registerBookablePatient,
} from './support/appointment-helpers.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const CLINICAL_KEYS = [
  'reason',
  'symptoms',
  'notes',
  'prescriptions',
  'medicalConditions',
  'medicalHistory',
  'allergies',
  'body',
];

describe('Admin appointment oversight', () => {
  let app: INestApplication;

  beforeEach(async () => {
    await resetDatabase();
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('Filter by date and status', async () => {
    const admin = await createAndSignInAdmin(app);
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const startsAt = nextSlotStart(new Date());
    await patient.agent
      .post('/api/appointments')
      .send({ doctorId: doctor.id, startsAt: startsAt.toISOString(), reason: 'Weekly checkup follow-up' })
      .expect(201);

    const weekFromNow = new Date(Date.now() + 7 * 24 * 3_600_000).toISOString();
    const res = await admin.agent
      .get('/api/admin/appointments')
      .query({ status: 'BOOKED', dateFrom: new Date().toISOString(), dateTo: weekFromNow })
      .expect(200);

    expect(res.body.items.length).toBeGreaterThanOrEqual(1);
    for (const item of res.body.items) {
      expect(item.status).toBe('BOOKED');
      expect(item).toHaveProperty('doctor.displayName');
      expect(item).toHaveProperty('patient.displayName');
      expect(item).toHaveProperty('consultationState');
    }
  });

  it('No clinical content', async () => {
    const admin = await createAndSignInAdmin(app);
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const dependent = await patient.agent
      .post('/api/patients/me/dependents')
      .send({ firstName: 'Jamie', lastName: 'Lovelace', birthDate: '2018-06-15', relationship: 'CHILD' })
      .expect(201);
    await patient.agent
      .patch(`/api/patients/me/dependents/${dependent.body.id as string}`)
      .send({ allergies: 'A very specific dependent allergy' })
      .expect(200);
    const startsAt = nextSlotStart(new Date());
    const booked = await patient.agent
      .post('/api/appointments')
      .send({
        doctorId: doctor.id,
        startsAt: startsAt.toISOString(),
        reason: 'Persistent cough and fever',
        dependentId: dependent.body.id,
      })
      .expect(201);

    await patient.agent
      .post(`/api/appointments/${booked.body.id as string}/messages`)
      .send({ body: 'This is a private message between us' })
      .expect(201);

    const list = await admin.agent.get('/api/admin/appointments').expect(200);
    const detail = await admin.agent.get(`/api/admin/appointments/${booked.body.id as string}`).expect(200);

    for (const payload of [list.body, detail.body]) {
      const serialized = JSON.stringify(payload);
      expect(serialized).not.toContain('Persistent cough and fever');
      expect(serialized).not.toContain('This is a private message between us');
      expect(serialized).not.toContain('A very specific dependent allergy');
      for (const key of CLINICAL_KEYS) {
        expect(serialized.includes(`"${key}"`)).toBe(false);
      }
    }
  });

  it('Attendee shown without dependent medical history', async () => {
    const admin = await createAndSignInAdmin(app);
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const dependent = await patient.agent
      .post('/api/patients/me/dependents')
      .send({ firstName: 'Jamie', lastName: 'Lovelace', birthDate: '2018-06-15', relationship: 'CHILD' })
      .expect(201);
    const startsAt = nextSlotStart(new Date());
    const booked = await patient.agent
      .post('/api/appointments')
      .send({
        doctorId: doctor.id,
        startsAt: startsAt.toISOString(),
        reason: 'Fever and sore throat',
        dependentId: dependent.body.id,
      })
      .expect(201);

    const detail = await admin.agent.get(`/api/admin/appointments/${booked.body.id as string}`).expect(200);
    expect(detail.body.dependent).toMatchObject({
      id: dependent.body.id,
      displayName: 'Jamie Lovelace',
      relationship: 'CHILD',
    });
    expect(detail.body.dependent.medicalConditions).toBeUndefined();
    expect(detail.body.dependent.allergies).toBeUndefined();

    const list = await admin.agent.get('/api/admin/appointments').expect(200);
    const entry = list.body.items.find((item: { id: string }) => item.id === (booked.body.id as string));
    expect(entry.dependent).toMatchObject({ id: dependent.body.id, displayName: 'Jamie Lovelace' });
  });

  it('Message metadata without content', async () => {
    const admin = await createAndSignInAdmin(app);
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const startsAt = nextSlotStart(new Date());
    const booked = await patient.agent
      .post('/api/appointments')
      .send({ doctorId: doctor.id, startsAt: startsAt.toISOString(), reason: 'Follow-up appointment' })
      .expect(201);
    const appointmentId = booked.body.id as string;

    await patient.agent.post(`/api/appointments/${appointmentId}/messages`).send({ body: 'First message' }).expect(201);
    await doctor.agent.post(`/api/appointments/${appointmentId}/messages`).send({ body: 'Second message' }).expect(201);
    const secondSentAt = new Date();
    await patient.agent.post(`/api/appointments/${appointmentId}/messages`).send({ body: 'Third message' }).expect(201);

    const detail = await admin.agent.get(`/api/admin/appointments/${appointmentId}`).expect(200);
    expect(detail.body.messageCount).toBe(3);
    expect(new Date(detail.body.lastMessageAt).getTime()).toBeGreaterThanOrEqual(secondSentAt.getTime());

    const list = await admin.agent.get('/api/admin/appointments').expect(200);
    const entry = list.body.items.find((item: { id: string }) => item.id === appointmentId);
    expect(entry.messageCount).toBe(3);
    expect(entry.lastMessageAt).toBe(detail.body.lastMessageAt);
  });

  it('Filter by consultation state', async () => {
    const admin = await createAndSignInAdmin(app);
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const scheduled = await createAppointmentDirect(app, {
      patientId: patient.id,
      doctorId: doctor.id,
      startsAt: nextSlotStart(new Date(), 30, 61),
    });
    const joinedAppointment = await createAppointmentDirect(app, {
      patientId: patient.id,
      doctorId: doctor.id,
      startsAt: nextSlotStart(new Date(), 30, 121),
    });
    const prisma = app.get(PrismaService);
    await prisma.consultationSession.create({
      data: { appointmentId: joinedAppointment.id, state: 'JOINED', patientJoinedAt: new Date() },
    });

    const scheduledRes = await admin.agent.get('/api/admin/appointments').query({ consultationState: 'SCHEDULED' }).expect(200);
    const scheduledIds = scheduledRes.body.items.map((i: { id: string }) => i.id);
    expect(scheduledIds).toContain(scheduled.id);
    expect(scheduledIds).not.toContain(joinedAppointment.id);

    const joinedRes = await admin.agent.get('/api/admin/appointments').query({ consultationState: 'JOINED' }).expect(200);
    const joinedIds = joinedRes.body.items.map((i: { id: string }) => i.id);
    expect(joinedIds).toContain(joinedAppointment.id);
    expect(joinedIds).not.toContain(scheduled.id);
  });

  it('Non-admin denied (oversight)', async () => {
    const patient = await registerPatient(app);
    const doctor = await registerDoctor(app);

    expect((await patient.agent.get('/api/admin/appointments')).status).toBe(403);
    expect((await doctor.agent.get('/api/admin/appointments')).status).toBe(403);
  });

  it('Past appointment never completed', async () => {
    const admin = await createAndSignInAdmin(app);
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const startsAt = new Date(Date.now() - 3 * 3_600_000);
    const appointment = await createAppointmentDirect(app, { patientId: patient.id, doctorId: doctor.id, startsAt });

    const res = await admin.agent.get(`/api/admin/appointments/${appointment.id}`).expect(200);
    expect(res.body.flags).toContain('NOT_COMPLETED');
  });

  it('Upcoming appointment with a suspended doctor', async () => {
    const admin = await createAndSignInAdmin(app);
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const startsAt = nextSlotStart(new Date());
    const booked = await patient.agent
      .post('/api/appointments')
      .send({ doctorId: doctor.id, startsAt: startsAt.toISOString(), reason: 'Follow-up consultation visit' })
      .expect(201);

    // An approved doctor can no longer be rejected (restrict-doctor-reject-after-approval); suspend
    // is the administrator's path to pull them out of active service, and the account-not-active
    // branch of invalid-booking detection is what actually flags the appointment either way.
    await admin.agent
      .post(`/api/admin/users/${doctor.id}/status`)
      .send({ status: 'SUSPENDED', reason: 'License could not be verified' })
      .expect(200);

    const res = await admin.agent.get(`/api/admin/appointments/${booked.body.id as string}`).expect(200);
    expect(res.body.flags).toContain('DOCTOR_UNAVAILABLE');
  });

  it('Cancel an invalid upcoming appointment', async () => {
    const admin = await createAndSignInAdmin(app);
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const startsAt = nextSlotStart(new Date());
    const booked = await patient.agent
      .post('/api/appointments')
      .send({ doctorId: doctor.id, startsAt: startsAt.toISOString(), reason: 'Follow-up consultation visit' })
      .expect(201);
    await admin.agent
      .post(`/api/admin/users/${doctor.id}/status`)
      .send({ status: 'SUSPENDED', reason: 'License could not be verified' })
      .expect(200);

    const res = await admin.agent
      .post(`/api/admin/appointments/${booked.body.id as string}/cancel`)
      .send({ reason: 'Doctor no longer verified on the platform' })
      .expect(200);

    expect(res.body).toMatchObject({ status: 'CANCELLED', cancelledByRole: 'ADMIN' });
  });

  it('Cancel without reason', async () => {
    const admin = await createAndSignInAdmin(app);
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const startsAt = nextSlotStart(new Date());
    const booked = await patient.agent
      .post('/api/appointments')
      .send({ doctorId: doctor.id, startsAt: startsAt.toISOString(), reason: 'Follow-up consultation visit' })
      .expect(201);

    const res = await admin.agent.post(`/api/admin/appointments/${booked.body.id as string}/cancel`).send({});
    expect(res.status).toBe(400);
  });

  it('Cancel an ended appointment', async () => {
    const admin = await createAndSignInAdmin(app);
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const startsAt = new Date(Date.now() - 3 * 3_600_000);
    const appointment = await createAppointmentDirect(app, { patientId: patient.id, doctorId: doctor.id, startsAt });

    const res = await admin.agent
      .post(`/api/admin/appointments/${appointment.id}/cancel`)
      .send({ reason: 'Attempting to cancel a past appointment' });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('APPOINTMENT_NOT_CANCELLABLE');
  });

  it('Resolve a stale appointment', async () => {
    const admin = await createAndSignInAdmin(app);
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const startsAt = new Date(Date.now() - 3 * 3_600_000);
    const appointment = await createAppointmentDirect(app, { patientId: patient.id, doctorId: doctor.id, startsAt });

    const res = await admin.agent
      .post(`/api/admin/appointments/${appointment.id}/mark-not-held`)
      .send({ reason: 'Patient did not attend' })
      .expect(200);

    expect(res.body.status).toBe('NOT_HELD');
    expect(res.body.flags).not.toContain('NOT_COMPLETED');

    const pastList = await patient.agent.get('/api/appointments').query({ scope: 'past' }).expect(200);
    const item = pastList.body.items.find((a: { id: string }) => a.id === appointment.id);
    expect(item?.status).toBe('NOT_HELD');
  });

  it('Not eligible', async () => {
    const admin = await createAndSignInAdmin(app);
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const startsAt = nextSlotStart(new Date());
    const booked = await patient.agent
      .post('/api/appointments')
      .send({ doctorId: doctor.id, startsAt: startsAt.toISOString(), reason: 'Follow-up consultation visit' })
      .expect(201);

    const res = await admin.agent
      .post(`/api/admin/appointments/${booked.body.id as string}/mark-not-held`)
      .send({ reason: 'Trying to resolve an upcoming appointment' });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('NOT_ELIGIBLE_FOR_NOT_HELD');
  });

  it('Admin cancellation notifies both', async () => {
    const admin = await createAndSignInAdmin(app);
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const startsAt = nextSlotStart(new Date());
    const booked = await patient.agent
      .post('/api/appointments')
      .send({ doctorId: doctor.id, startsAt: startsAt.toISOString(), reason: 'Follow-up consultation visit' })
      .expect(201);

    await admin.agent
      .post(`/api/admin/appointments/${booked.body.id as string}/cancel`)
      .send({ reason: 'Scheduling conflict identified by staff' })
      .expect(200);

    const prisma = app.get(PrismaService);
    const patientNotification = await prisma.notification.findFirstOrThrow({
      where: { userId: patient.id, type: 'PLATFORM_APPOINTMENT_CANCELLED' },
    });
    const doctorNotification = await prisma.notification.findFirstOrThrow({
      where: { userId: doctor.id, type: 'PLATFORM_APPOINTMENT_CANCELLED' },
    });
    expect(patientNotification.title).toBe('Appointment cancelled');
    expect(doctorNotification.title).toBe('Appointment cancelled');
    expect(patientNotification.body).toContain('Scheduling conflict identified by staff');
  });
});
