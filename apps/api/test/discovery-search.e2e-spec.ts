import { afterEach, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './support/test-app.js';
import { resetDatabase } from './support/reset-db.js';
import { registerDoctor, registerPatient } from './support/auth-helpers.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { PasswordHasherService } from '../src/auth/password/password-hasher.service.js';
import { AccountStatus, Role, VerificationStatus } from '../src/generated/prisma/enums.js';

interface SpecializationRow {
  id: string;
  slug: string;
  name: string;
}

/**
 * Creates an already-approved doctor directly via Prisma, bypassing the
 * public registration endpoint's 5/minute/IP rate limit — used only by the
 * pagination test, which needs many doctors in a single app instance.
 */
async function createApprovedDoctor(
  app: INestApplication,
  specializationId: string,
  index: number,
): Promise<string> {
  const prisma = app.get(PrismaService);
  const hasher = app.get(PasswordHasherService);
  const passwordHash = await hasher.hash('correct-horse-battery');
  const user = await prisma.user.create({
    data: { email: `pagination-${Date.now()}-${index}@example.com`, passwordHash, role: Role.DOCTOR },
  });
  await prisma.doctorProfile.create({
    data: {
      userId: user.id,
      firstName: 'Doc',
      lastName: `Number${index}`,
      licenseNumber: `LIC-PG-${Date.now()}-${index}`,
      verificationStatus: VerificationStatus.APPROVED,
      specializations: { create: [{ specializationId }] },
    },
  });
  return user.id;
}

async function approveDoctor(app: INestApplication, doctorId: string): Promise<void> {
  const prisma = app.get(PrismaService);
  await prisma.doctorProfile.update({
    where: { userId: doctorId },
    data: { verificationStatus: VerificationStatus.APPROVED },
  });
}

async function setAccountStatus(
  app: INestApplication,
  userId: string,
  status: AccountStatus,
): Promise<void> {
  const prisma = app.get(PrismaService);
  await prisma.user.update({ where: { id: userId }, data: { status } });
}

function isoWeekday(date: Date): number {
  const day = date.getUTCDay();
  return day === 0 ? 7 : day;
}

/** A full-day weekly rule (00:00-24:00) so a slot always exists unless the run
 * happens to land in the last lead-time minutes of the day. */
function fullDayRule(weekday: number) {
  return { weekday, startMinute: 0, endMinute: 1440 };
}

describe('Doctor search', () => {
  let app: INestApplication;
  let specializations: SpecializationRow[];

  beforeAll(async () => {
    await resetDatabase();
    const bootstrapApp = await createTestApp();
    const list = await request(bootstrapApp.getHttpServer()).get('/api/specializations').expect(200);
    specializations = list.body as SpecializationRow[];
    await bootstrapApp.close();
  });

  function specBySlug(slug: string): SpecializationRow {
    const found = specializations.find((s) => s.slug === slug);
    if (!found) throw new Error(`No specialization with slug ${slug}`);
    return found;
  }

  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('Only approved, active doctors listed', async () => {
    const approved = await registerDoctor(app, { specializationIds: [specBySlug('dermatology').id] });
    await approveDoctor(app, approved.id);

    const pending = await registerDoctor(app, { specializationIds: [specBySlug('dermatology').id] });

    const rejected = await registerDoctor(app, { specializationIds: [specBySlug('dermatology').id] });
    await approveDoctor(app, rejected.id);
    await app.get(PrismaService).doctorProfile.update({
      where: { userId: rejected.id },
      data: { verificationStatus: VerificationStatus.REJECTED },
    });

    const suspended = await registerDoctor(app, { specializationIds: [specBySlug('dermatology').id] });
    await approveDoctor(app, suspended.id);
    await setAccountStatus(app, suspended.id, AccountStatus.SUSPENDED);

    const patient = await registerPatient(app);
    const res = await patient.agent.get('/api/doctors');

    expect(res.status).toBe(200);
    const ids = res.body.items.map((item: { id: string }) => item.id);
    expect(ids).toContain(approved.id);
    expect(ids).not.toContain(pending.id);
    expect(ids).not.toContain(rejected.id);
    expect(ids).not.toContain(suspended.id);
  });

  it('Text query', async () => {
    const derma = await registerDoctor(app, { specializationIds: [specBySlug('dermatology').id] });
    await approveDoctor(app, derma.id);
    const cardio = await registerDoctor(app, { specializationIds: [specBySlug('cardiology').id] });
    await approveDoctor(app, cardio.id);

    const patient = await registerPatient(app);
    const res = await patient.agent.get('/api/doctors').query({ q: 'derma' });

    expect(res.status).toBe(200);
    const ids = res.body.items.map((item: { id: string }) => item.id);
    expect(ids).toContain(derma.id);
    expect(ids).not.toContain(cardio.id);
  });

  it('Specialization filter', async () => {
    const cardio = await registerDoctor(app, { specializationIds: [specBySlug('cardiology').id] });
    await approveDoctor(app, cardio.id);
    const derma = await registerDoctor(app, { specializationIds: [specBySlug('dermatology').id] });
    await approveDoctor(app, derma.id);

    const patient = await registerPatient(app);
    const res = await patient.agent.get('/api/doctors').query({ specialization: 'cardiology' });

    expect(res.status).toBe(200);
    const ids = res.body.items.map((item: { id: string }) => item.id);
    expect(ids).toContain(cardio.id);
    expect(ids).not.toContain(derma.id);
  });

  it('Availability filter', async () => {
    const soon = await registerDoctor(app, { specializationIds: [specBySlug('dermatology').id] });
    await approveDoctor(app, soon.id);
    await soon.agent
      .put('/api/doctors/me/availability')
      .send({ timezone: 'UTC', rules: [1, 2, 3, 4, 5, 6, 7].map(fullDayRule) })
      .expect(200);

    const later = await registerDoctor(app, { specializationIds: [specBySlug('dermatology').id] });
    await approveDoctor(app, later.id);
    await later.agent
      .put('/api/doctors/me/availability')
      .send({ timezone: 'UTC', rules: [1, 2, 3, 4, 5, 6, 7].map(fullDayRule) })
      .expect(200);
    const now = new Date();
    await later.agent
      .post('/api/doctors/me/availability/exceptions')
      .send({
        startsAt: now.toISOString(),
        endsAt: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        reason: 'blocked for test',
      })
      .expect(201);

    const patient = await registerPatient(app);
    const from = new Date().toISOString();
    const to = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    const res = await patient.agent
      .get('/api/doctors')
      .query({ availableFrom: from, availableTo: to });

    expect(res.status).toBe(200);
    const ids = res.body.items.map((item: { id: string }) => item.id);
    expect(ids).toContain(soon.id);
    expect(ids).not.toContain(later.id);
  });

  it('Invalid filters', async () => {
    const patient = await registerPatient(app);

    const unknownSpecialization = await patient.agent
      .get('/api/doctors')
      .query({ specialization: 'not-a-real-slug' });
    expect(unknownSpecialization.status).toBe(400);

    const tooLongRange = await patient.agent.get('/api/doctors').query({
      availableFrom: new Date().toISOString(),
      availableTo: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
    });
    expect(tooLongRange.status).toBe(400);

    const tooBigPage = await patient.agent.get('/api/doctors').query({ pageSize: 51 });
    expect(tooBigPage.status).toBe(400);
  });

  it('Signed-out denied (search)', async () => {
    const res = await request(app.getHttpServer()).get('/api/doctors');
    expect(res.status).toBe(401);
  });

  it('Default sort', async () => {
    const today = await registerDoctor(app, { specializationIds: [specBySlug('dermatology').id] });
    await approveDoctor(app, today.id);
    await today.agent
      .put('/api/doctors/me/availability')
      .send({ timezone: 'UTC', rules: [1, 2, 3, 4, 5, 6, 7].map(fullDayRule) })
      .expect(200);

    const tomorrowWeekday = isoWeekday(new Date(Date.now() + 24 * 60 * 60 * 1000));
    const tomorrow = await registerDoctor(app, { specializationIds: [specBySlug('dermatology').id] });
    await approveDoctor(app, tomorrow.id);
    await tomorrow.agent
      .put('/api/doctors/me/availability')
      .send({ timezone: 'UTC', rules: [fullDayRule(tomorrowWeekday)] })
      .expect(200);

    const none = await registerDoctor(app, { specializationIds: [specBySlug('dermatology').id] });
    await approveDoctor(app, none.id);

    const patient = await registerPatient(app);
    const res = await patient.agent.get('/api/doctors').query({ specialization: 'dermatology' });

    expect(res.status).toBe(200);
    const ids = res.body.items.map((item: { id: string }) => item.id);
    const todayIndex = ids.indexOf(today.id);
    const tomorrowIndex = ids.indexOf(tomorrow.id);
    const noneIndex = ids.indexOf(none.id);
    expect(todayIndex).toBeGreaterThanOrEqual(0);
    expect(tomorrowIndex).toBeGreaterThan(todayIndex);
    expect(noneIndex).toBeGreaterThan(tomorrowIndex);
  });

  it('Pagination', async () => {
    // A specialization no other test in this file uses, so the count here is exact.
    const specializationId = specBySlug('endocrinology').id;
    for (let i = 0; i < 15; i++) {
      await createApprovedDoctor(app, specializationId, i);
    }

    const patient = await registerPatient(app);
    const res = await patient.agent
      .get('/api/doctors')
      .query({ specialization: 'endocrinology', page: 2, pageSize: 12 });

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(15);
    expect(res.body.items).toHaveLength(3);
    expect(res.body.page).toBe(2);
    expect(res.body.pageSize).toBe(12);
  });
});
