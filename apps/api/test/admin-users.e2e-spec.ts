import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import type request from 'supertest';
import { createTestApp } from './support/test-app.js';
import { resetDatabase } from './support/reset-db.js';
import { createAndSignInAdmin, registerDoctor, registerPatient } from './support/auth-helpers.js';
import { nextSlotStart, registerBookableDoctor, registerBookablePatient } from './support/appointment-helpers.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { AuditService } from '../src/audit/audit.service.js';
import { AuditEntityType } from '../src/audit/audit-entity-type.js';
import { AuditAction } from '../src/generated/prisma/enums.js';

async function bookAppointment(
  agent: ReturnType<typeof request.agent>,
  doctorId: string,
  leadMinutes = 61,
): Promise<string> {
  const startsAt = nextSlotStart(new Date(), 30, leadMinutes).toISOString();
  const res = await agent
    .post('/api/appointments')
    .send({ doctorId, startsAt, reason: 'Recurring headaches for a week' })
    .expect(201);
  return res.body.id as string;
}

describe('Admin users', () => {
  let app: INestApplication;

  beforeEach(async () => {
    await resetDatabase();
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('Filter by role and status', async () => {
    const admin = await createAndSignInAdmin(app);
    const doctor = await registerDoctor(app);
    const prisma = app.get(PrismaService);
    await prisma.user.update({ where: { id: doctor.id }, data: { status: 'SUSPENDED', statusReason: 'x' } });
    await registerPatient(app);

    const res = await admin.agent.get('/api/admin/users').query({ role: 'DOCTOR', status: 'SUSPENDED' }).expect(200);

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({ id: doctor.id, role: 'DOCTOR', status: 'SUSPENDED' });
  });

  it('Text query', async () => {
    const admin = await createAndSignInAdmin(app);
    const santos = await registerPatient(app, { firstName: 'Maria', lastName: 'Santos' });
    await registerPatient(app, { firstName: 'Ana', lastName: 'Cruz' });

    const res = await admin.agent.get('/api/admin/users').query({ q: 'santos' }).expect(200);

    expect(res.body.items.map((u: { id: string }) => u.id)).toEqual([santos.id]);
  });

  it('Non-admin denied (accounts)', async () => {
    const patient = await registerPatient(app);
    const doctor = await registerDoctor(app);

    expect((await patient.agent.get('/api/admin/users')).status).toBe(403);
    expect((await doctor.agent.get('/api/admin/users')).status).toBe(403);
    expect(
      (await patient.agent.post(`/api/admin/users/${patient.id}/status`).send({ status: 'SUSPENDED', reason: 'test reason' }))
        .status,
    ).toBe(403);
  });

  it('Suspend a patient', async () => {
    const admin = await createAndSignInAdmin(app);
    const patient = await registerPatient(app);

    const res = await admin.agent
      .post(`/api/admin/users/${patient.id}/status`)
      .send({ status: 'SUSPENDED', reason: 'Repeated abusive messages to staff' })
      .expect(200);

    expect(res.body).toMatchObject({ status: 'SUSPENDED', statusReason: 'Repeated abusive messages to staff' });

    const next = await patient.agent.get('/api/auth/me');
    expect(next.status).toBe(401);
  });

  it('Deactivate a doctor with bookings', async () => {
    const admin = await createAndSignInAdmin(app);
    const doctor = await registerBookableDoctor(app);
    const patientA = await registerBookablePatient(app);
    const patientB = await registerBookablePatient(app);

    await bookAppointment(patientA.agent, doctor.id, 61);
    await bookAppointment(patientB.agent, doctor.id, 121);

    const res = await admin.agent
      .post(`/api/admin/users/${doctor.id}/status`)
      .send({ status: 'DEACTIVATED', reason: 'Credential fraud discovered' })
      .expect(200);

    expect(res.body.status).toBe('DEACTIVATED');

    const prisma = app.get(PrismaService);
    const appointments = await prisma.appointment.findMany({ where: { doctorId: doctor.id } });
    expect(appointments).toHaveLength(2);
    for (const appointment of appointments) {
      expect(appointment.status).toBe('CANCELLED');
      expect(appointment.cancellationReason).toContain('Credential fraud discovered');
    }

    const search = await patientA.agent.get('/api/doctors').expect(200);
    expect(search.body.items.map((d: { id: string }) => d.id)).not.toContain(doctor.id);
  });

  it('Reactivate', async () => {
    const admin = await createAndSignInAdmin(app);
    const patient = await registerPatient(app);
    await admin.agent.post(`/api/admin/users/${patient.id}/status`).send({ status: 'SUSPENDED', reason: 'Initial suspension reason' }).expect(200);

    const res = await admin.agent
      .post(`/api/admin/users/${patient.id}/status`)
      .send({ status: 'ACTIVE', reason: 'Appeal reviewed and accepted' })
      .expect(200);
    expect(res.body.status).toBe('ACTIVE');

    const login = await patient.agent.post('/api/auth/login').send({ email: patient.email, password: patient.password });
    expect(login.status).toBe(200);
  });

  it('Missing reason', async () => {
    const admin = await createAndSignInAdmin(app);
    const patient = await registerPatient(app);

    const res = await admin.agent.post(`/api/admin/users/${patient.id}/status`).send({ status: 'SUSPENDED' });

    expect(res.status).toBe(400);
    const prisma = app.get(PrismaService);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: patient.id } });
    expect(after.status).toBe('ACTIVE');
  });

  it('Admin account protected', async () => {
    const admin = await createAndSignInAdmin(app);

    const res = await admin.agent
      .post(`/api/admin/users/${admin.id}/status`)
      .send({ status: 'SUSPENDED', reason: 'Should not be allowed at all' });

    expect(res.status).toBe(403);
    const prisma = app.get(PrismaService);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: admin.id } });
    expect(after.status).toBe('ACTIVE');
  });

  it('No-op change', async () => {
    const admin = await createAndSignInAdmin(app);
    const patient = await registerPatient(app);

    const res = await admin.agent
      .post(`/api/admin/users/${patient.id}/status`)
      .send({ status: 'ACTIVE', reason: 'Already active, no change needed' });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('STATUS_UNCHANGED');
  });

  it('Status change audited', async () => {
    const admin = await createAndSignInAdmin(app);
    const patient = await registerPatient(app);

    await admin.agent
      .post(`/api/admin/users/${patient.id}/status`)
      .send({ status: 'SUSPENDED', reason: 'Repeated abusive messages to staff' })
      .expect(200);

    const prisma = app.get(PrismaService);
    const entries = await prisma.auditLog.findMany({
      where: { action: AuditAction.USER_STATUS_CHANGED, entityId: patient.id },
    });

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      entityType: AuditEntityType.USER,
      reason: 'Repeated abusive messages to staff',
      before: { status: 'ACTIVE' },
      after: { status: 'SUSPENDED' },
    });
    expect(entries[0]?.requestId.length).toBeGreaterThan(0);
  });

  it('Deactivation lists cancelled appointments', async () => {
    const admin = await createAndSignInAdmin(app);
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const appointmentId = await bookAppointment(patient.agent, doctor.id);

    await admin.agent
      .post(`/api/admin/users/${doctor.id}/status`)
      .send({ status: 'DEACTIVATED', reason: 'Leaving the platform' })
      .expect(200);

    const prisma = app.get(PrismaService);
    const entry = await prisma.auditLog.findFirstOrThrow({
      where: { action: AuditAction.USER_STATUS_CHANGED, entityId: doctor.id },
    });
    expect(entry.after).toMatchObject({ cancelledAppointmentIds: [appointmentId] });
  });

  it('Deactivation notifies the counterpart only', async () => {
    const admin = await createAndSignInAdmin(app);
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    await bookAppointment(patient.agent, doctor.id);

    await admin.agent
      .post(`/api/admin/users/${doctor.id}/status`)
      .send({ status: 'DEACTIVATED', reason: 'Leaving the platform' })
      .expect(200);

    const prisma = app.get(PrismaService);
    const patientNotifications = await prisma.notification.findMany({
      where: { userId: patient.id, type: 'PLATFORM_APPOINTMENT_CANCELLED' },
    });
    expect(patientNotifications).toHaveLength(1);

    const doctorNotifications = await prisma.notification.findMany({
      where: { userId: doctor.id, type: 'PLATFORM_APPOINTMENT_CANCELLED' },
    });
    expect(doctorNotifications).toHaveLength(0);
  });

  it('Atomicity: a forced failure after the audit write rolls back the status change', async () => {
    const admin = await createAndSignInAdmin(app);
    const patient = await registerPatient(app);
    const prisma = app.get(PrismaService);
    const auditService = app.get(AuditService);

    await expect(
      prisma.$transaction(async (tx) => {
        await tx.user.update({ where: { id: patient.id }, data: { status: 'SUSPENDED', statusReason: 'x' } });
        await auditService.record(tx, {
          actorId: admin.id,
          action: AuditAction.USER_STATUS_CHANGED,
          entityType: AuditEntityType.USER,
          entityId: patient.id,
          reason: 'x',
          before: { status: 'ACTIVE' },
          after: { status: 'SUSPENDED' },
        });
        throw new Error('forced rollback for the atomicity test');
      }),
    ).rejects.toThrow('forced rollback for the atomicity test');

    const user = await prisma.user.findUniqueOrThrow({ where: { id: patient.id } });
    expect(user.status).toBe('ACTIVE');

    const entries = await prisma.auditLog.findMany({ where: { entityId: patient.id } });
    expect(entries).toHaveLength(0);
  });
});
