import { afterEach, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { createTestApp } from './support/test-app.js';
import { resetDatabase } from './support/reset-db.js';
import { registerDoctor, registerPatient } from './support/auth-helpers.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

function nextMonday(hour: number): Date {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + ((8 - date.getUTCDay()) % 7 || 7));
  date.setUTCHours(hour, 0, 0, 0);
  return date;
}

describe('Doctor time off', () => {
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

  it('Add time off', async () => {
    const doctor = await registerDoctor(app);
    const startsAt = nextMonday(0);
    const endsAt = new Date(startsAt.getTime() + 2 * 24 * 60 * 60 * 1000); // next Wednesday 00:00

    const res = await doctor.agent.post('/api/doctors/me/availability/exceptions').send({
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      reason: 'Conference',
    });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      reason: 'Conference',
    });
    expect(res.body.id).toBeDefined();
  });

  it('Invalid time off', async () => {
    const doctor = await registerDoctor(app);
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const endsBeforeStart = await doctor.agent.post('/api/doctors/me/availability/exceptions').send({
      startsAt: future.toISOString(),
      endsAt: new Date(future.getTime() - 60_000).toISOString(),
    });
    expect(endsBeforeStart.status).toBe(400);

    const endsInPast = await doctor.agent.post('/api/doctors/me/availability/exceptions').send({
      startsAt: past.toISOString(),
      endsAt: new Date(past.getTime() + 60_000).toISOString(),
    });
    expect(endsInPast.status).toBe(400);

    const tooLong = await doctor.agent.post('/api/doctors/me/availability/exceptions').send({
      startsAt: future.toISOString(),
      endsAt: new Date(future.getTime() + 91 * 24 * 60 * 60 * 1000).toISOString(),
    });
    expect(tooLong.status).toBe(400);

    const availability = await doctor.agent.get('/api/doctors/me/availability');
    expect(availability.body.timeOff).toEqual([]);
  });

  it('Delete own time off', async () => {
    const doctor = await registerDoctor(app);
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const created = await doctor.agent
      .post('/api/doctors/me/availability/exceptions')
      .send({ startsAt: future.toISOString(), endsAt: new Date(future.getTime() + 3_600_000).toISOString() })
      .expect(201);

    const res = await doctor.agent.delete(`/api/doctors/me/availability/exceptions/${created.body.id}`);
    expect(res.status).toBe(204);

    const availability = await doctor.agent.get('/api/doctors/me/availability');
    expect(availability.body.timeOff).toEqual([]);
  });

  it("Another doctor's time off", async () => {
    const doctorA = await registerDoctor(app);
    const doctorB = await registerDoctor(app);
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const created = await doctorA.agent
      .post('/api/doctors/me/availability/exceptions')
      .send({ startsAt: future.toISOString(), endsAt: new Date(future.getTime() + 3_600_000).toISOString() })
      .expect(201);

    const res = await doctorB.agent.delete(`/api/doctors/me/availability/exceptions/${created.body.id}`);
    expect(res.status).toBe(404);

    const availabilityA = await doctorA.agent.get('/api/doctors/me/availability');
    expect(availabilityA.body.timeOff).toHaveLength(1);
  });

  it('Time off over a booking', async () => {
    const doctor = await registerDoctor(app);
    const patient = await registerPatient(app);

    const startsAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    const endsAt = new Date(startsAt.getTime() + 30 * 60 * 1000);
    const prisma = app.get(PrismaService);
    const booked = await prisma.appointment.create({
      data: {
        patientId: patient.id,
        doctorId: doctor.id,
        startsAt,
        endsAt,
        reason: 'A booking that time off would cover',
        status: 'BOOKED',
      },
    });

    const res = await doctor.agent.post('/api/doctors/me/availability/exceptions').send({
      startsAt: new Date(startsAt.getTime() - 60 * 60 * 1000).toISOString(),
      endsAt: new Date(endsAt.getTime() + 60 * 60 * 1000).toISOString(),
      reason: 'Conference',
    });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('SCHEDULE_CONFLICTS_WITH_BOOKINGS');
    expect(res.body.details.appointments).toEqual([
      expect.objectContaining({ id: booked.id }),
    ]);

    const availability = await doctor.agent.get('/api/doctors/me/availability');
    expect(availability.body.timeOff).toEqual([]);
  });
});
