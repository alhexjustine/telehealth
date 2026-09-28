import { afterEach, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { createTestApp } from './support/test-app.js';
import { resetDatabase } from './support/reset-db.js';
import {
  completeAppointmentDirect,
  createAppointmentDirect,
  registerBookableDoctor,
  registerBookablePatient,
} from './support/appointment-helpers.js';

async function completeConsultation(
  app: INestApplication,
  patient: Awaited<ReturnType<typeof registerBookablePatient>>,
  doctor: Awaited<ReturnType<typeof registerBookableDoctor>>,
  startsAt: Date,
  options: { dependentId?: string; patientSummary?: string } = {},
): Promise<{ id: string }> {
  const appointment = await createAppointmentDirect(app, {
    patientId: patient.id,
    doctorId: doctor.id,
    startsAt,
    dependentId: options.dependentId,
  });
  await completeAppointmentDirect(app, appointment.id, options.patientSummary ?? 'Rest and hydrate.');
  return appointment;
}

async function addDependent(
  patient: Awaited<ReturnType<typeof registerBookablePatient>>,
  overrides: Partial<{ firstName: string; lastName: string; birthDate: string; relationship: string }> = {},
): Promise<string> {
  const res = await patient.agent
    .post('/api/patients/me/dependents')
    .send({
      firstName: overrides.firstName ?? 'Jamie',
      lastName: overrides.lastName ?? 'Lovelace',
      birthDate: overrides.birthDate ?? '2018-06-15',
      relationship: overrides.relationship ?? 'CHILD',
    })
    .expect(201);
  return res.body.id as string;
}

describe('Records scoped per dependent', () => {
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

  it('Patient lists a dependent\'s records', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const dependentId = await addDependent(patient);
    await completeConsultation(app, patient, doctor, new Date(Date.now() + 60_000), {
      dependentId,
      patientSummary: 'Child visit summary',
    });

    const res = await patient.agent.get('/api/records').expect(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].dependent).toMatchObject({ id: dependentId, displayName: 'Jamie Lovelace', relationship: 'CHILD' });
  });

  it('Filter to one dependent', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const dependentId = await addDependent(patient, { firstName: 'Jamie' });
    const otherDependentId = await addDependent(patient, { firstName: 'Sam', relationship: 'PARENT', birthDate: '1960-01-01' });
    await completeConsultation(app, patient, doctor, new Date(Date.now() + 60_000), { dependentId });
    await completeConsultation(app, patient, doctor, new Date(Date.now() + 2 * 60 * 60_000), {
      dependentId: otherDependentId,
    });
    await completeConsultation(app, patient, doctor, new Date(Date.now() + 3 * 60 * 60_000));

    const all = await patient.agent.get('/api/records').expect(200);
    expect(all.body.items).toHaveLength(3);

    const filtered = await patient.agent.get('/api/records').query({ dependentId }).expect(200);
    expect(filtered.body.items).toHaveLength(1);
    expect(filtered.body.items[0].dependent.id).toBe(dependentId);

    const selfOnly = await patient.agent.get('/api/records').query({ dependentId: 'self' }).expect(200);
    expect(selfOnly.body.items).toHaveLength(1);
    expect(selfOnly.body.items[0].dependent).toBeNull();
  });

  it("Treating doctor views a dependent's record", async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const dependentId = await addDependent(patient);
    await createAppointmentDirect(app, {
      patientId: patient.id,
      doctorId: doctor.id,
      startsAt: new Date(Date.now() + 24 * 60 * 60_000),
      dependentId,
    });

    const res = await doctor.agent.get(`/api/patients/${patient.id}/record`).query({ dependentId }).expect(200);
    expect(res.body).toMatchObject({
      patientId: patient.id,
      dependentId,
      relationship: 'CHILD',
      firstName: 'Jamie',
      lastName: 'Lovelace',
    });
    expect(res.body.appointmentsWithDoctor).toHaveLength(1);
  });

  it('Treating relationship does not cross dependents', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const dependentId = await addDependent(patient, { firstName: 'Jamie' });
    const otherDependentId = await addDependent(patient, { firstName: 'Sam', relationship: 'PARENT', birthDate: '1960-01-01' });
    await createAppointmentDirect(app, {
      patientId: patient.id,
      doctorId: doctor.id,
      startsAt: new Date(Date.now() + 24 * 60 * 60_000),
      dependentId,
    });

    // The doctor has only ever treated `dependentId` — not the account holder themselves, and not `otherDependentId`.
    const selfAttempt = await doctor.agent.get(`/api/patients/${patient.id}/record`);
    expect(selfAttempt.status).toBe(404);

    const otherDependentAttempt = await doctor.agent
      .get(`/api/patients/${patient.id}/record`)
      .query({ dependentId: otherDependentId });
    expect(otherDependentAttempt.status).toBe(404);
  });

  it("Removed dependent's history remains", async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const dependentId = await addDependent(patient);
    await completeConsultation(app, patient, doctor, new Date(Date.now() + 60_000), {
      dependentId,
      patientSummary: 'Child visit summary',
    });

    await patient.agent.delete(`/api/patients/me/dependents/${dependentId}`).expect(200);

    const res = await patient.agent.get('/api/records').expect(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].dependent).toMatchObject({ id: dependentId, displayName: 'Jamie Lovelace' });
  });
});
