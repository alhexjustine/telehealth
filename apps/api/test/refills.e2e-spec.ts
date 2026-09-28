import { afterEach, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './support/test-app.js';
import { resetDatabase } from './support/reset-db.js';
import { createAndSignInAdmin } from './support/auth-helpers.js';
import {
  addPrescriptionDirect,
  completeAppointmentDirect,
  createAppointmentDirect,
  registerBookableDoctor,
  registerBookablePatient,
} from './support/appointment-helpers.js';

async function addDependent(
  patient: Awaited<ReturnType<typeof registerBookablePatient>>,
  overrides: Partial<{ firstName: string; lastName: string }> = {},
): Promise<string> {
  const res = await patient.agent
    .post('/api/patients/me/dependents')
    .send({
      firstName: overrides.firstName ?? 'Jamie',
      lastName: overrides.lastName ?? 'Lovelace',
      birthDate: '2018-06-15',
      relationship: 'CHILD',
    })
    .expect(201);
  return res.body.id as string;
}

async function completedPrescription(
  app: INestApplication,
  patient: Awaited<ReturnType<typeof registerBookablePatient>>,
  doctor: Awaited<ReturnType<typeof registerBookableDoctor>>,
  options: { dependentId?: string } = {},
): Promise<{ appointmentId: string; prescriptionId: string }> {
  const appointment = await createAppointmentDirect(app, {
    patientId: patient.id,
    doctorId: doctor.id,
    startsAt: new Date(Date.now() + 60_000),
    dependentId: options.dependentId,
  });
  await completeAppointmentDirect(app, appointment.id);
  const prescription = await addPrescriptionDirect(app, appointment.id);
  return { appointmentId: appointment.id, prescriptionId: prescription.id };
}

function refillPath(appointmentId: string, prescriptionId: string): string {
  return `/api/records/${appointmentId}/prescriptions/${prescriptionId}/refill-requests`;
}

describe('Requesting a refill', () => {
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

  it('Patient requests a refill', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const { appointmentId, prescriptionId } = await completedPrescription(app, patient, doctor);

    const res = await patient.agent
      .post(refillPath(appointmentId, prescriptionId))
      .send({ patientNote: 'still symptomatic' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ status: 'PENDING', patientNote: 'still symptomatic', prescriptionId });
  });

  it('Requesting for a dependent', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const dependentId = await addDependent(patient);
    const { appointmentId, prescriptionId } = await completedPrescription(app, patient, doctor, { dependentId });

    const res = await patient.agent.post(refillPath(appointmentId, prescriptionId)).send({});

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ status: 'PENDING' });
    expect(res.body.dependent).toMatchObject({ id: dependentId });
  });

  it('Duplicate pending request', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const { appointmentId, prescriptionId } = await completedPrescription(app, patient, doctor);

    await patient.agent.post(refillPath(appointmentId, prescriptionId)).send({}).expect(201);
    const res = await patient.agent.post(refillPath(appointmentId, prescriptionId)).send({});

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('REFILL_REQUEST_ALREADY_PENDING');
  });

  it("Not the patient's own record", async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const otherPatient = await registerBookablePatient(app);
    const { appointmentId, prescriptionId } = await completedPrescription(app, patient, doctor);

    const res = await otherPatient.agent.post(refillPath(appointmentId, prescriptionId)).send({});

    expect(res.status).toBe(404);
  });

  it('Consultation not yet completed', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const appointment = await createAppointmentDirect(app, {
      patientId: patient.id,
      doctorId: doctor.id,
      startsAt: new Date(Date.now() + 24 * 60 * 60_000),
    });
    const prescription = await addPrescriptionDirect(app, appointment.id);

    const res = await patient.agent.post(refillPath(appointment.id, prescription.id)).send({});

    expect(res.status).toBe(404);
  });

  it('Signed-out denied', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const { appointmentId, prescriptionId } = await completedPrescription(app, patient, doctor);

    const res = await request(app.getHttpServer()).post(refillPath(appointmentId, prescriptionId)).send({});

    expect(res.status).toBe(401);
  });

  it('Administrator requests refill data', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const { appointmentId, prescriptionId } = await completedPrescription(app, patient, doctor);
    const admin = await createAndSignInAdmin(app);

    const requestRes = await admin.agent.post(refillPath(appointmentId, prescriptionId)).send({});
    expect(requestRes.status).toBe(403);

    const listRes = await admin.agent.get('/api/doctors/me/refill-requests');
    expect(listRes.status).toBe(403);
  });

  it('Doctor notified of a new request', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const { appointmentId, prescriptionId } = await completedPrescription(app, patient, doctor);

    await patient.agent.post(refillPath(appointmentId, prescriptionId)).send({}).expect(201);

    const doctorNotifications = await doctor.agent.get('/api/notifications').expect(200);
    const refillNotifications = doctorNotifications.body.items.filter((item: { type: string }) => item.type === 'REFILL_REQUESTED');
    expect(refillNotifications).toHaveLength(1);
    expect(refillNotifications[0].readAt).toBeNull();
  });

  it('Failed request creates nothing', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const { appointmentId, prescriptionId } = await completedPrescription(app, patient, doctor);
    await patient.agent.post(refillPath(appointmentId, prescriptionId)).send({}).expect(201);

    // Second request against the same prescription is a duplicate-pending conflict.
    await patient.agent.post(refillPath(appointmentId, prescriptionId)).send({}).expect(409);

    const doctorNotifications = await doctor.agent.get('/api/notifications').expect(200);
    const refillNotifications = doctorNotifications.body.items.filter((item: { type: string }) => item.type === 'REFILL_REQUESTED');
    expect(refillNotifications).toHaveLength(1);
  });
});

describe('Doctor decides a refill request', () => {
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

  it('Doctor approves a request', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const { appointmentId, prescriptionId } = await completedPrescription(app, patient, doctor);
    const created = await patient.agent.post(refillPath(appointmentId, prescriptionId)).send({}).expect(201);

    const res = await doctor.agent
      .post(`/api/doctors/me/refill-requests/${created.body.id}/approve`)
      .send({ doctorNote: 'Renewed for another 30 days' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'APPROVED', doctorNote: 'Renewed for another 30 days' });
    expect(res.body.decidedAt).not.toBeNull();

    const recordRes = await patient.agent.get(`/api/records/${appointmentId}`).expect(200);
    expect(recordRes.body.prescriptions[0].id).toBe(prescriptionId);
    expect(recordRes.body.prescriptions[0].medication).toBe('Amoxicillin');
  });

  it('Doctor denies a request', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const { appointmentId, prescriptionId } = await completedPrescription(app, patient, doctor);
    const created = await patient.agent.post(refillPath(appointmentId, prescriptionId)).send({}).expect(201);

    const res = await doctor.agent
      .post(`/api/doctors/me/refill-requests/${created.body.id}/deny`)
      .send({ doctorNote: 'Please book a follow-up first' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'DENIED', doctorNote: 'Please book a follow-up first' });
  });

  it('Already-decided request', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const { appointmentId, prescriptionId } = await completedPrescription(app, patient, doctor);
    const created = await patient.agent.post(refillPath(appointmentId, prescriptionId)).send({}).expect(201);
    await doctor.agent.post(`/api/doctors/me/refill-requests/${created.body.id}/approve`).send({}).expect(200);

    const res = await doctor.agent.post(`/api/doctors/me/refill-requests/${created.body.id}/deny`).send({});

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('REFILL_REQUEST_NOT_PENDING');
  });

  it('Not the treating doctor', async () => {
    const doctor = await registerBookableDoctor(app);
    const otherDoctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const { appointmentId, prescriptionId } = await completedPrescription(app, patient, doctor);
    const created = await patient.agent.post(refillPath(appointmentId, prescriptionId)).send({}).expect(201);

    const approveRes = await otherDoctor.agent.post(`/api/doctors/me/refill-requests/${created.body.id}/approve`).send({});
    expect(approveRes.status).toBe(404);

    const listRes = await otherDoctor.agent.get('/api/doctors/me/refill-requests').expect(200);
    expect(listRes.body.items).toHaveLength(0);
  });

  it('Patient cannot decide their own request', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const { appointmentId, prescriptionId } = await completedPrescription(app, patient, doctor);
    const created = await patient.agent.post(refillPath(appointmentId, prescriptionId)).send({}).expect(201);

    const res = await patient.agent.post(`/api/doctors/me/refill-requests/${created.body.id}/approve`).send({});

    expect(res.status).toBe(403);
  });

  it("Dependent's refill request is isolated", async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const dependentId = await addDependent(patient, { firstName: 'Jamie' });
    const otherDependentId = await addDependent(patient, { firstName: 'Alex' });

    const dependentPrescription = await completedPrescription(app, patient, doctor, { dependentId });
    await patient.agent.post(refillPath(dependentPrescription.appointmentId, dependentPrescription.prescriptionId)).send({}).expect(201);

    // The doctor has only ever treated `dependentId` — not the account holder, and not `otherDependentId`.
    const listRes = await doctor.agent.get('/api/doctors/me/refill-requests').expect(200);
    expect(listRes.body.items).toHaveLength(1);
    expect(listRes.body.items[0].dependent).toMatchObject({ id: dependentId });
    expect(listRes.body.items[0].dependent.id).not.toBe(otherDependentId);
  });

  it('Patient notified of approval', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const { appointmentId, prescriptionId } = await completedPrescription(app, patient, doctor);
    const created = await patient.agent.post(refillPath(appointmentId, prescriptionId)).send({}).expect(201);

    await doctor.agent
      .post(`/api/doctors/me/refill-requests/${created.body.id}/approve`)
      .send({ doctorNote: 'Renewed for another 30 days' })
      .expect(200);

    const patientNotifications = await patient.agent.get('/api/notifications').expect(200);
    const decided = patientNotifications.body.items.filter((item: { type: string }) => item.type === 'REFILL_DECIDED');
    expect(decided).toHaveLength(1);
    expect(decided[0].body as string).toContain('Renewed for another 30 days');
  });

  it('Patient notified of denial', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const { appointmentId, prescriptionId } = await completedPrescription(app, patient, doctor);
    const created = await patient.agent.post(refillPath(appointmentId, prescriptionId)).send({}).expect(201);

    await doctor.agent.post(`/api/doctors/me/refill-requests/${created.body.id}/deny`).send({}).expect(200);

    const patientNotifications = await patient.agent.get('/api/notifications').expect(200);
    const decided = patientNotifications.body.items.filter((item: { type: string }) => item.type === 'REFILL_DECIDED');
    expect(decided).toHaveLength(1);
  });
});

describe('Refill status visible on the patient record', () => {
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

  it('Patient sees a pending request', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const { appointmentId, prescriptionId } = await completedPrescription(app, patient, doctor);
    await patient.agent.post(refillPath(appointmentId, prescriptionId)).send({ patientNote: 'still symptomatic' }).expect(201);

    const res = await patient.agent.get(`/api/records/${appointmentId}`).expect(200);

    expect(res.body.prescriptions[0].refillRequests).toHaveLength(1);
    expect(res.body.prescriptions[0].refillRequests[0]).toMatchObject({ status: 'PENDING', patientNote: 'still symptomatic' });
  });

  it('Patient sees a decided request', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const { appointmentId, prescriptionId } = await completedPrescription(app, patient, doctor);
    const created = await patient.agent.post(refillPath(appointmentId, prescriptionId)).send({}).expect(201);
    await doctor.agent
      .post(`/api/doctors/me/refill-requests/${created.body.id}/approve`)
      .send({ doctorNote: 'Renewed for another 30 days' })
      .expect(200);

    const res = await patient.agent.get(`/api/records/${appointmentId}`).expect(200);

    expect(res.body.prescriptions[0].refillRequests[0]).toMatchObject({
      status: 'APPROVED',
      doctorNote: 'Renewed for another 30 days',
    });
  });
});
