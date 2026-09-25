import { afterEach, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { createTestApp } from './support/test-app.js';
import { resetDatabase } from './support/reset-db.js';
import { createAppointmentDirect, registerBookableDoctor, registerBookablePatient } from './support/appointment-helpers.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

/** Joins the patient and starts the consultation, so notes/prescriptions can be written (session `IN_PROGRESS`). */
async function startInProgressAppointment(
  app: INestApplication,
  patient: Awaited<ReturnType<typeof registerBookablePatient>>,
  doctor: Awaited<ReturnType<typeof registerBookableDoctor>>,
  startsAt: Date,
): Promise<{ id: string }> {
  const appointment = await createAppointmentDirect(app, { patientId: patient.id, doctorId: doctor.id, startsAt });
  await patient.agent.post(`/api/consultations/${appointment.id}/join`).expect(200);
  await doctor.agent.post(`/api/consultations/${appointment.id}/start`).expect(200);
  return appointment;
}

describe('Consultation notes', () => {
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

  it('Doctor saves a draft note', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const appointment = await startInProgressAppointment(app, patient, doctor, new Date(Date.now() + 60_000));

    const res = await doctor.agent
      .put(`/api/consultations/${appointment.id}/note`)
      .send({ findings: 'Mild fever', plan: 'Rest and fluids' });
    expect(res.status).toBe(200);
    expect(res.body.findings).toBe('Mild fever');
    expect(res.body.plan).toBe('Rest and fluids');
  });

  it('Note before joining', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const appointment = await createAppointmentDirect(app, {
      patientId: patient.id,
      doctorId: doctor.id,
      startsAt: new Date(Date.now() + 60_000),
    });

    const res = await doctor.agent.put(`/api/consultations/${appointment.id}/note`).send({ findings: 'Too soon' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('SESSION_NOT_ACTIVE');
  });

  it('Patient cannot write notes', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const appointment = await startInProgressAppointment(app, patient, doctor, new Date(Date.now() + 60_000));

    const res = await patient.agent.put(`/api/consultations/${appointment.id}/note`).send({ findings: 'Nope' });
    expect(res.status).toBe(403);
  });

  it('Edit after completion (note)', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const appointment = await startInProgressAppointment(app, patient, doctor, new Date(Date.now() + 60_000));

    const prisma = app.get(PrismaService);
    await prisma.consultationNote.create({ data: { appointmentId: appointment.id, patientSummary: 'All clear.' } });
    await doctor.agent.post(`/api/consultations/${appointment.id}/complete`).expect(200);

    const res = await doctor.agent.put(`/api/consultations/${appointment.id}/note`).send({ findings: 'Too late' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('RECORD_LOCKED');

    const note = await prisma.consultationNote.findUniqueOrThrow({ where: { appointmentId: appointment.id } });
    expect(note.findings).toBeNull();
  });
});

describe('Prescriptions', () => {
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

  it('Add a prescription', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const appointment = await startInProgressAppointment(app, patient, doctor, new Date(Date.now() + 60_000));

    const res = await doctor.agent.post(`/api/consultations/${appointment.id}/prescriptions`).send({
      medication: 'Amoxicillin',
      dosage: '500 mg',
      frequency: '3 times a day',
      duration: '7 days',
    });
    expect(res.status).toBe(201);
    expect(res.body.medication).toBe('Amoxicillin');
    expect(res.body.id).toBeDefined();
  });

  it('Missing required field', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const appointment = await startInProgressAppointment(app, patient, doctor, new Date(Date.now() + 60_000));

    const res = await doctor.agent.post(`/api/consultations/${appointment.id}/prescriptions`).send({
      medication: 'Amoxicillin',
      frequency: '3 times a day',
      duration: '7 days',
    });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body.message ?? res.body.errors ?? '')).toContain('dosage');
  });

  it('Edit after completion (prescription)', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const appointment = await startInProgressAppointment(app, patient, doctor, new Date(Date.now() + 60_000));

    const created = await doctor.agent
      .post(`/api/consultations/${appointment.id}/prescriptions`)
      .send({ medication: 'Amoxicillin', dosage: '500 mg', frequency: '3 times a day', duration: '7 days' })
      .expect(201);

    const prisma = app.get(PrismaService);
    await prisma.consultationNote.create({ data: { appointmentId: appointment.id, patientSummary: 'All clear.' } });
    await doctor.agent.post(`/api/consultations/${appointment.id}/complete`).expect(200);

    const updateRes = await doctor.agent
      .patch(`/api/consultations/${appointment.id}/prescriptions/${created.body.id}`)
      .send({ dosage: '1000 mg' });
    expect(updateRes.status).toBe(409);
    expect(updateRes.body.code).toBe('RECORD_LOCKED');

    const deleteRes = await doctor.agent.delete(`/api/consultations/${appointment.id}/prescriptions/${created.body.id}`);
    expect(deleteRes.status).toBe(409);
    expect(deleteRes.body.code).toBe('RECORD_LOCKED');
  });

  it('rejects a 21st prescription', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const appointment = await startInProgressAppointment(app, patient, doctor, new Date(Date.now() + 60_000));

    for (let i = 0; i < 20; i++) {
      await doctor.agent
        .post(`/api/consultations/${appointment.id}/prescriptions`)
        .send({ medication: `Drug ${i}`, dosage: '1 unit', frequency: 'daily', duration: '1 day' })
        .expect(201);
    }

    const res = await doctor.agent
      .post(`/api/consultations/${appointment.id}/prescriptions`)
      .send({ medication: 'Drug 21', dosage: '1 unit', frequency: 'daily', duration: '1 day' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('PRESCRIPTION_LIMIT_REACHED');
  });
});
