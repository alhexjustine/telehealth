import { afterEach, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { createTestApp } from './support/test-app.js';
import { resetDatabase } from './support/reset-db.js';
import { createAndSignInAdmin, registerDoctor, registerPatient } from './support/auth-helpers.js';
import {
  createAppointmentDirect,
  registerBookableDoctor,
  registerBookablePatient,
} from './support/appointment-helpers.js';

describe('Workspace access', () => {
  let app: INestApplication;

  beforeAll(async () => {
    await resetDatabase();
  });

  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('Participant views the workspace', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const startsAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const appointment = await createAppointmentDirect(app, { patientId: patient.id, doctorId: doctor.id, startsAt });

    const res = await patient.agent.get(`/api/consultations/${appointment.id}`);
    expect(res.status).toBe(200);
    expect(res.body.appointmentId).toBe(appointment.id);
    expect(res.body.session.state).toBe('SCHEDULED');
    expect(res.body.patientMedicalSummary).toBeUndefined();
  });

  it('Doctor sees the patient summary', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    await patient.agent
      .patch('/api/patients/me/profile')
      .send({ medicalConditions: 'Asthma', allergies: 'Penicillin', currentMedications: 'Albuterol' })
      .expect(200);
    const startsAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const appointment = await createAppointmentDirect(app, { patientId: patient.id, doctorId: doctor.id, startsAt });

    const res = await doctor.agent.get(`/api/consultations/${appointment.id}`);
    expect(res.status).toBe(200);
    expect(res.body.patientMedicalSummary).toMatchObject({
      medicalConditions: 'Asthma',
      allergies: 'Penicillin',
      currentMedications: 'Albuterol',
    });
    expect(typeof res.body.patientMedicalSummary.age).toBe('number');
  });

  it('Non-participant denied', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const otherPatient = await registerPatient(app);
    const otherDoctor = await registerDoctor(app);
    const admin = await createAndSignInAdmin(app);
    const startsAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const appointment = await createAppointmentDirect(app, { patientId: patient.id, doctorId: doctor.id, startsAt });

    const otherPatientRes = await otherPatient.agent.get(`/api/consultations/${appointment.id}`);
    expect(otherPatientRes.status).toBe(404);

    const otherDoctorRes = await otherDoctor.agent.get(`/api/consultations/${appointment.id}`);
    expect(otherDoctorRes.status).toBe(404);

    const adminRes = await admin.agent.get(`/api/consultations/${appointment.id}`);
    expect(adminRes.status).toBe(403);
  });

  it('Cancelled appointment', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const startsAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const appointment = await createAppointmentDirect(app, {
      patientId: patient.id,
      doctorId: doctor.id,
      startsAt,
      status: 'CANCELLED',
    });

    const res = await patient.agent.get(`/api/consultations/${appointment.id}`);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('APPOINTMENT_NOT_ACTIVE');
  });
});

describe('Joining', () => {
  let app: INestApplication;

  beforeAll(async () => {
    await resetDatabase();
  });

  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('Join within the window', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const startsAt = new Date(Date.now() + 10 * 60_000); // starts in 10 minutes; join opens at -15m
    const appointment = await createAppointmentDirect(app, { patientId: patient.id, doctorId: doctor.id, startsAt });

    const res = await patient.agent.post(`/api/consultations/${appointment.id}/join`);
    expect(res.status).toBe(200);
    expect(res.body.state).toBe('JOINED');
    expect(res.body.patientJoinedAt).not.toBeNull();
  });

  it('Too early or too late', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);

    const tooEarlyStart = new Date(Date.now() + 20 * 60_000); // 20 minutes ahead; window opens at 15
    const tooEarly = await createAppointmentDirect(app, {
      patientId: patient.id,
      doctorId: doctor.id,
      startsAt: tooEarlyStart,
    });
    const earlyRes = await patient.agent.post(`/api/consultations/${tooEarly.id}/join`);
    expect(earlyRes.status).toBe(409);
    expect(earlyRes.body.code).toBe('OUTSIDE_JOIN_WINDOW');

    // Ends 31 minutes ago (started 61 minutes ago, 30-minute appointment).
    const tooLateStart = new Date(Date.now() - 61 * 60_000);
    const tooLateEnd = new Date(Date.now() - 31 * 60_000);
    const tooLate = await createAppointmentDirect(app, {
      patientId: patient.id,
      doctorId: doctor.id,
      startsAt: tooLateStart,
      endsAt: tooLateEnd,
    });
    const lateRes = await patient.agent.post(`/api/consultations/${tooLate.id}/join`);
    expect(lateRes.status).toBe(409);
    expect(lateRes.body.code).toBe('OUTSIDE_JOIN_WINDOW');
  });

  it('Rejoin', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const startsAt = new Date(Date.now() + 10 * 60_000);
    const appointment = await createAppointmentDirect(app, { patientId: patient.id, doctorId: doctor.id, startsAt });

    const first = await patient.agent.post(`/api/consultations/${appointment.id}/join`).expect(200);
    const firstJoinedAt = first.body.patientJoinedAt as string;

    const second = await patient.agent.post(`/api/consultations/${appointment.id}/join`).expect(200);
    expect(second.body.patientJoinedAt).toBe(firstJoinedAt);
    expect(second.body.state).toBe('JOINED');
  });
});
