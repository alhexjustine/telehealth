import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { AppointmentStatus } from '../../src/generated/prisma/enums.js';
import { LIVE_CONSULTATION_REASON_PREFIX, PRIMARY_DOCTOR_EMAIL, PRIMARY_PATIENT_EMAIL } from './constants.js';

export interface LiveConsultationResult {
  appointmentId: string;
  startsAt: Date;
  endsAt: Date;
}

/**
 * Creates, or replaces, a `BOOKED` appointment between the primary demo
 * patient and doctor starting 10 minutes from `now` — see the `demo-data`
 * spec's "Live consultation command". Deliberately bypasses the normal
 * booking service (and its 60-minute lead time) the same way the rest of
 * this seed does, per design.md's "Live consultation".
 */
export async function stageLiveConsultation(prisma: PrismaClient, now: Date = new Date()): Promise<LiveConsultationResult> {
  const doctor = await prisma.user.findUnique({
    where: { email: PRIMARY_DOCTOR_EMAIL },
    include: { doctorProfile: true },
  });
  const patient = await prisma.user.findUnique({ where: { email: PRIMARY_PATIENT_EMAIL } });
  if (!doctor?.doctorProfile || !patient) {
    throw new Error(
      `Demo accounts not found (${PRIMARY_DOCTOR_EMAIL} / ${PRIMARY_PATIENT_EMAIL}). Run the default seed first.`,
    );
  }
  const consultationMinutes = doctor.doctorProfile.consultationMinutes;

  // Replace any previously staged appointment for this pair so there is only ever one.
  await prisma.appointment.deleteMany({
    where: {
      patientId: patient.id,
      doctorId: doctor.id,
      reason: { startsWith: LIVE_CONSULTATION_REASON_PREFIX },
    },
  });

  let startsAt = new Date(now.getTime() + 10 * 60_000);
  let endsAt = new Date(startsAt.getTime() + consultationMinutes * 60_000);

  // Shift forward in consultation-length steps if this pair already has
  // another booked appointment in the way (e.g. one of the seeded upcoming
  // appointments) — never touches that other appointment.
  const MAX_SHIFTS = 100;
  for (let attempt = 0; attempt < MAX_SHIFTS; attempt += 1) {
    const overlap = await prisma.appointment.findFirst({
      where: {
        status: AppointmentStatus.BOOKED,
        OR: [{ doctorId: doctor.id }, { patientId: patient.id }],
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
      },
    });
    if (!overlap) break;
    startsAt = new Date(startsAt.getTime() + consultationMinutes * 60_000);
    endsAt = new Date(startsAt.getTime() + consultationMinutes * 60_000);
  }

  const appointment = await prisma.appointment.create({
    data: {
      patientId: patient.id,
      doctorId: doctor.id,
      startsAt,
      endsAt,
      reason: `${LIVE_CONSULTATION_REASON_PREFIX} Live demo consultation, staged for a walkthrough.`,
      status: AppointmentStatus.BOOKED,
    },
  });

  console.log(
    `Staged a live consultation: appointment ${appointment.id} starting ${startsAt.toISOString()} (${consultationMinutes} min).`,
  );
  return { appointmentId: appointment.id, startsAt, endsAt };
}
