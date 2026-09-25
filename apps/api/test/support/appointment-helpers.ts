import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { VerificationStatus } from '../../src/generated/prisma/enums.js';
import { registerDoctor, registerPatient, type RegisteredUser } from './auth-helpers.js';

/** Approves a doctor directly via Prisma (bypassing the admin review flow, which doesn't exist yet). */
export async function approveDoctor(app: INestApplication, doctorId: string): Promise<void> {
  const prisma = app.get(PrismaService);
  await prisma.doctorProfile.update({
    where: { userId: doctorId },
    data: { verificationStatus: VerificationStatus.APPROVED },
  });
}

/** Fills every field `isPatientProfileComplete` requires, so the patient can book. */
export async function completePatientProfile(
  agent: ReturnType<typeof request.agent>,
  overrides: Partial<{ birthDate: string; weightKg: number; heightCm: number; phone: string }> = {},
): Promise<void> {
  await agent
    .patch('/api/patients/me/profile')
    .send({
      birthDate: overrides.birthDate ?? '1990-01-31',
      weightKg: overrides.weightKg ?? 65,
      heightCm: overrides.heightCm ?? 170,
      phone: overrides.phone ?? '+15550100',
    })
    .expect(200);
}

/**
 * Gives the doctor a full-week, all-day UTC schedule: since UTC has no
 * offset, every half-hour boundary (00:00, 00:30, 01:00, ...) is a valid
 * slot start regardless of which day it falls on — which is what lets
 * `nextSlotStart` compute a guaranteed-available start without querying the
 * slots endpoint first.
 */
export async function giveFullWeekAvailability(agent: ReturnType<typeof request.agent>): Promise<void> {
  const rules = [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ weekday, startMinute: 0, endMinute: 1440 }));
  await agent.put('/api/doctors/me/availability').send({ timezone: 'UTC', rules }).expect(200);
}

/**
 * The next slot start at least `leadMinutes` + a small buffer from now,
 * aligned to `stepMinutes` — matches what `giveFullWeekAvailability` plus a
 * UTC schedule offers. Independent of the current wall-clock time, so tests
 * don't flake near day/slot boundaries.
 */
export function nextSlotStart(now: Date, stepMinutes = 30, leadMinutes = 61): Date {
  const stepMs = stepMinutes * 60_000;
  const earliest = now.getTime() + leadMinutes * 60_000;
  const aligned = Math.ceil(earliest / stepMs) * stepMs;
  return new Date(aligned);
}

/** Registers a patient with a complete profile, ready to book. */
export async function registerBookablePatient(
  app: INestApplication,
  overrides: Parameters<typeof registerPatient>[1] = {},
): Promise<RegisteredUser> {
  const patient = await registerPatient(app, overrides);
  await completePatientProfile(patient.agent);
  return patient;
}

/** Registers, approves, and gives a full-week UTC schedule to a doctor, ready to be booked. */
export async function registerBookableDoctor(
  app: INestApplication,
  overrides: Parameters<typeof registerDoctor>[1] = {},
): Promise<RegisteredUser> {
  const doctor = await registerDoctor(app, overrides);
  await approveDoctor(app, doctor.id);
  await giveFullWeekAvailability(doctor.agent);
  return doctor;
}
