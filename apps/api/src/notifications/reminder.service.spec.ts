import { describe, expect, it, jest } from '@jest/globals';
import { AppointmentStatus, NotificationType } from '../generated/prisma/enums.js';
import type { NotificationsService } from './notifications.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { ReminderService } from './reminder.service.js';

interface FakeAppointment {
  id: string;
  status: AppointmentStatus;
  startsAt: Date;
  createdAt: Date;
  doctorId: string;
  patientId: string;
  doctor: { firstName: string; lastName: string };
  patient: { firstName: string; lastName: string };
}

interface FindManyArgs {
  where: {
    status?: AppointmentStatus;
    startsAt?: { gt?: Date; lte?: Date };
  };
}

interface CreateArgs {
  data: { userId: string; type: NotificationType; dedupeKey?: string };
}

const DOCTOR = { firstName: 'Grace', lastName: 'Hopper' };
const PATIENT = { firstName: 'Ada', lastName: 'Lovelace' };

function buildAppointment(overrides: Partial<FakeAppointment> = {}): FakeAppointment {
  return {
    id: 'appt-1',
    status: AppointmentStatus.BOOKED,
    startsAt: new Date('2026-01-02T00:00:00.000Z'),
    createdAt: new Date('2025-12-01T00:00:00.000Z'),
    doctorId: 'doctor-1',
    patientId: 'patient-1',
    doctor: DOCTOR,
    patient: PATIENT,
    ...overrides,
  };
}

/** A minimal in-memory stand-in for the two Prisma delegates `ReminderService` uses, real enough to exercise its actual filter logic. */
function createFakePrisma(appointments: FakeAppointment[]) {
  const createdDrafts: CreateArgs['data'][] = [];

  const findMany = jest.fn(async ({ where }: FindManyArgs) =>
    appointments.filter((appointment) => {
      if (where.status && appointment.status !== where.status) return false;
      if (where.startsAt?.gt && appointment.startsAt.getTime() <= where.startsAt.gt.getTime()) return false;
      if (where.startsAt?.lte && appointment.startsAt.getTime() > where.startsAt.lte.getTime()) return false;
      return true;
    }),
  );

  const create = jest.fn(async ({ data }: CreateArgs) => {
    createdDrafts.push(data);
    return { id: `notif-${createdDrafts.length}`, readAt: null, createdAt: new Date(), ...data };
  });

  const prisma = { appointment: { findMany }, notification: { create } } as unknown as PrismaService;
  return { prisma, findMany, create, createdDrafts };
}

function createFakeNotifications(): NotificationsService {
  return { publish: jest.fn(async () => undefined) } as unknown as NotificationsService;
}

describe('ReminderService.run window selection', () => {
  it('creates a 24-hour reminder for an appointment booked well ahead, 23h58m from starting', async () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    const appointment = buildAppointment({
      startsAt: new Date(now.getTime() + (24 * 60 - 2) * 60_000),
      createdAt: new Date(now.getTime() - 3 * 24 * 3_600_000),
    });
    const { prisma, createdDrafts } = createFakePrisma([appointment]);
    const service = new ReminderService(prisma, createFakeNotifications());

    await service.run(now);

    const drafts24h = createdDrafts.filter((d) => d.type === NotificationType.REMINDER_24H);
    expect(drafts24h).toHaveLength(2);
    expect(drafts24h.map((d) => d.userId).sort()).toEqual(['doctor-1', 'patient-1']);
  });

  it('creates a 1-hour reminder for an appointment 58 minutes away', async () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    const appointment = buildAppointment({
      startsAt: new Date(now.getTime() + 58 * 60_000),
      // Booked 2 hours ago: short notice for the 24h window, plenty for the 1h one.
      createdAt: new Date(now.getTime() - 2 * 3_600_000),
    });
    const { prisma, createdDrafts } = createFakePrisma([appointment]);
    const service = new ReminderService(prisma, createFakeNotifications());

    await service.run(now);

    const drafts1h = createdDrafts.filter((d) => d.type === NotificationType.REMINDER_1H);
    expect(drafts1h).toHaveLength(2);
    expect(drafts1h.map((d) => d.userId).sort()).toEqual(['doctor-1', 'patient-1']);
  });

  it('does not create a 24-hour reminder for a short-notice booking (window already begun when booked)', async () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    const appointment = buildAppointment({
      startsAt: new Date(now.getTime() + 3 * 3_600_000), // starts in 3 hours
      createdAt: now, // booked just now
    });
    const { prisma, createdDrafts } = createFakePrisma([appointment]);
    const service = new ReminderService(prisma, createFakeNotifications());

    await service.run(now);

    expect(createdDrafts.some((d) => d.type === NotificationType.REMINDER_24H)).toBe(false);
    expect(createdDrafts.filter((d) => d.type === NotificationType.REMINDER_1H)).toHaveLength(0); // window (1h) hasn't begun yet either
  });

  it('excludes a cancelled appointment even if it falls within the window', async () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    const cancelled = buildAppointment({
      id: 'appt-cancelled',
      status: AppointmentStatus.CANCELLED,
      startsAt: new Date(now.getTime() + 30 * 60_000),
      createdAt: new Date(now.getTime() - 3 * 24 * 3_600_000),
    });
    const { prisma, createdDrafts } = createFakePrisma([cancelled]);
    const service = new ReminderService(prisma, createFakeNotifications());

    await service.run(now);

    expect(createdDrafts).toHaveLength(0);
  });

  it('sets a stable dedupe key per appointment, window, and recipient', async () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    // Short notice for the 24h window (booked 2h ago) so only the 1h window applies here.
    const appointment = buildAppointment({
      startsAt: new Date(now.getTime() + 30 * 60_000),
      createdAt: new Date(now.getTime() - 2 * 3_600_000),
    });
    const { prisma, createdDrafts } = createFakePrisma([appointment]);
    const service = new ReminderService(prisma, createFakeNotifications());

    await service.run(now);

    const dedupeKeys = createdDrafts.map((d) => d.dedupeKey).sort();
    expect(dedupeKeys).toEqual(['reminder:1h:appt-1:doctor-1', 'reminder:1h:appt-1:patient-1'].sort());
  });
});
