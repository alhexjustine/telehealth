import type { PrismaClient, Prisma } from '../../src/generated/prisma/client.js';
import {
  Role,
  AppointmentStatus,
  SessionState,
  AuditAction,
} from '../../src/generated/prisma/enums.js';
import { PasswordHasherService } from '../../src/auth/password/password-hasher.service.js';
import { generateSlots, type Slot } from '../../src/availability/slot-generator.js';
import { AuditService } from '../../src/audit/audit.service.js';
import { AuditEntityType } from '../../src/audit/audit-entity-type.js';
import { bookNotificationDrafts } from '../../src/notifications/appointment-notifications.js';
import type { NotificationDraft } from '../../src/notifications/notification.types.js';
import {
  DEMO_DOCTORS,
  DEMO_PATIENTS,
  SPECIALIZATION_SLUG_TO_ID,
  doctorEmail,
  patientEmail,
  type DemoDoctorFixture,
} from './fixtures.js';
import { DEMO_PASSWORD, PRIMARY_PATIENT_EMAIL } from './constants.js';
import { pastLocalInstant } from './time.js';

const auditService = new AuditService();

export interface SeedResult {
  seeded: boolean;
  doctorCount?: number;
  patientCount?: number;
  appointmentCount?: number;
}

/** The `demo-data` spec's presence check: the primary demo patient existing means the dataset already loaded. */
export async function isDemoDataPresent(prisma: PrismaClient): Promise<boolean> {
  const existing = await prisma.user.findUnique({ where: { email: PRIMARY_PATIENT_EMAIL } });
  return existing !== null;
}

/**
 * Loads the full demo dataset if it isn't present yet. Idempotent: a second
 * call is a no-op (see the `demo-data` spec's "Restart leaves demo data
 * unchanged"). `now` is injectable so tests can pin appointment math.
 */
export async function seedDemoDataset(prisma: PrismaClient, now: Date = new Date()): Promise<SeedResult> {
  if (await isDemoDataPresent(prisma)) {
    console.log(`Demo data already present (${PRIMARY_PATIENT_EMAIL} exists); leaving it unchanged.`);
    return { seeded: false };
  }

  const hasher = new PasswordHasherService();
  const passwordHash = await hasher.hash(DEMO_PASSWORD);
  const admin = await prisma.user.findFirst({ where: { role: Role.ADMIN }, orderBy: { createdAt: 'asc' } });
  if (!admin) {
    console.warn('No administrator account found; demo data will be seeded without audit-log entries.');
  }

  const result = await prisma.$transaction(
    async (tx) => {
      const doctorIds = await createDoctors(tx, passwordHash);
      const patientIds = await createPatients(tx, passwordHash);

      if (admin) {
        await recordProvisioningAudit(tx, admin.id, doctorIds, patientIds);
      }

      const appointmentCount = await createAppointments(tx, now, doctorIds, patientIds);

      return {
        seeded: true,
        doctorCount: DEMO_DOCTORS.length,
        patientCount: DEMO_PATIENTS.length,
        appointmentCount,
      } satisfies SeedResult;
    },
    { maxWait: 15_000, timeout: 60_000 },
  );

  console.log(
    `Seeded demo data: ${result.doctorCount} doctors, ${result.patientCount} patients, ${result.appointmentCount} appointments.`,
  );
  return result;
}

type Tx = Prisma.TransactionClient;

async function createDoctors(tx: Tx, passwordHash: string): Promise<Map<string, { id: string; fixture: DemoDoctorFixture }>> {
  const idsByLocalPart = new Map<string, { id: string; fixture: DemoDoctorFixture }>();

  for (const fixture of DEMO_DOCTORS) {
    const user = await tx.user.create({
      data: {
        email: doctorEmail(fixture),
        passwordHash,
        role: Role.DOCTOR,
        status: fixture.accountStatus,
        statusReason: fixture.statusReason,
      },
    });
    await tx.doctorProfile.create({
      data: {
        userId: user.id,
        firstName: fixture.firstName,
        lastName: fixture.lastName,
        bio: fixture.bio,
        yearsOfExperience: fixture.yearsOfExperience,
        licenseNumber: fixture.licenseNumber,
        consultationMinutes: fixture.consultationMinutes,
        verificationStatus: fixture.verificationStatus,
        reviewNote: fixture.reviewNote,
        timezone: fixture.timezone,
        specializations: {
          create: fixture.specializationSlugs.map((slug) => ({
            specializationId: SPECIALIZATION_SLUG_TO_ID[slug]!,
          })),
        },
      },
    });
    if (fixture.rules.length > 0) {
      await tx.availabilityRule.createMany({
        data: fixture.rules.map((rule) => ({
          doctorId: user.id,
          weekday: rule.weekday,
          startMinute: rule.startMinute,
          endMinute: rule.endMinute,
        })),
      });
    }
    idsByLocalPart.set(fixture.emailLocalPart, { id: user.id, fixture });
  }

  return idsByLocalPart;
}

async function createPatients(tx: Tx, passwordHash: string): Promise<Map<string, string>> {
  const idsByLocalPart = new Map<string, string>();

  for (const fixture of DEMO_PATIENTS) {
    const user = await tx.user.create({
      data: {
        email: patientEmail(fixture),
        passwordHash,
        role: Role.PATIENT,
        status: fixture.accountStatus,
        statusReason: fixture.statusReason,
      },
    });
    await tx.patientProfile.create({
      data: {
        userId: user.id,
        firstName: fixture.firstName,
        lastName: fixture.lastName,
        birthDate: fixture.birthDate ? new Date(`${fixture.birthDate}T00:00:00.000Z`) : null,
        weightKg: fixture.weightKg,
        heightCm: fixture.heightCm,
        phone: fixture.phone,
        emergencyContactName: fixture.emergencyContactName,
        emergencyContactPhone: fixture.emergencyContactPhone,
        medicalConditions: fixture.medicalConditions,
        allergies: fixture.allergies,
        currentMedications: fixture.currentMedications,
      },
    });
    idsByLocalPart.set(fixture.emailLocalPart, user.id);
  }

  return idsByLocalPart;
}

async function recordProvisioningAudit(
  tx: Tx,
  adminId: string,
  doctorIds: Map<string, { id: string; fixture: DemoDoctorFixture }>,
  patientIds: Map<string, string>,
): Promise<void> {
  for (const { id, fixture } of doctorIds.values()) {
    if (fixture.verificationStatus === 'APPROVED') {
      await auditService.record(tx, {
        actorId: adminId,
        action: AuditAction.DOCTOR_APPROVED,
        entityType: AuditEntityType.DOCTOR_PROFILE,
        entityId: id,
        before: { verificationStatus: 'PENDING', reviewNote: null },
        after: { verificationStatus: 'APPROVED', reviewNote: null },
      });
      if (fixture.accountStatus === 'SUSPENDED') {
        await auditService.record(tx, {
          actorId: adminId,
          action: AuditAction.USER_STATUS_CHANGED,
          entityType: AuditEntityType.USER,
          entityId: id,
          reason: fixture.statusReason,
          before: { status: 'ACTIVE', statusReason: null },
          after: { status: 'SUSPENDED', statusReason: fixture.statusReason },
        });
      }
    } else if (fixture.verificationStatus === 'REJECTED') {
      await auditService.record(tx, {
        actorId: adminId,
        action: AuditAction.DOCTOR_REJECTED,
        entityType: AuditEntityType.DOCTOR_PROFILE,
        entityId: id,
        reason: fixture.reviewNote,
        before: { verificationStatus: 'PENDING', reviewNote: null },
        after: { verificationStatus: 'REJECTED', reviewNote: fixture.reviewNote },
      });
    }
  }

  const suspendedPatientEntry = DEMO_PATIENTS.find((patient) => patient.accountStatus === 'SUSPENDED');
  if (suspendedPatientEntry) {
    const patientId = patientIds.get(suspendedPatientEntry.emailLocalPart);
    if (patientId) {
      await auditService.record(tx, {
        actorId: adminId,
        action: AuditAction.USER_STATUS_CHANGED,
        entityType: AuditEntityType.USER,
        entityId: patientId,
        reason: suspendedPatientEntry.statusReason,
        before: { status: 'ACTIVE', statusReason: null },
        after: { status: 'SUSPENDED', statusReason: suspendedPatientEntry.statusReason },
      });
    }
  }
}

/**
 * The first slot in `[now + minDays, now + maxDays)` that doesn't overlap
 * anything in `exclude` (the primary patient's already-assigned times this
 * run) — the range is wide (2 weeks) so a doctor who only works one or two
 * weekdays (e.g. the OB-GYN's Mon/Thu-only schedule) is still guaranteed a
 * match regardless of what day the seed happens to run on; `exclude` is what
 * actually keeps the patient's own appointments from colliding, since two
 * different doctors' generated slots could otherwise coincidentally land on
 * the same instant.
 */
function pickSlot(
  fixture: DemoDoctorFixture,
  now: Date,
  minDays: number,
  maxDays: number,
  exclude: readonly { start: Date; end: Date }[],
): Slot {
  const from = new Date(now.getTime() + minDays * 86_400_000);
  const to = new Date(now.getTime() + maxDays * 86_400_000);
  const slots = generateSlots({
    timezone: fixture.timezone,
    consultationMinutes: fixture.consultationMinutes,
    rules: fixture.rules,
    exceptions: [],
    booked: [],
    from,
    to,
    now,
  });
  const free = slots.find(
    (slot) =>
      !exclude.some((interval) => slot.start.getTime() < interval.end.getTime() && slot.end.getTime() > interval.start.getTime()),
  );
  if (!free) {
    throw new Error(
      `seed-demo: no free slots for ${fixture.firstName} ${fixture.lastName} in [${minDays}, ${maxDays}) days`,
    );
  }
  return free;
}

async function createAppointments(
  tx: Tx,
  now: Date,
  doctorIds: Map<string, { id: string; fixture: DemoDoctorFixture }>,
  patientIds: Map<string, string>,
): Promise<number> {
  const primaryDoctor = doctorIds.get('doctor')!;
  const cardiologyDoctor = doctorIds.get('dr.cardiology')!;
  const dermatologyDoctor = doctorIds.get('dr.dermatology')!;
  const obgynDoctor = doctorIds.get('dr.obgyn')!;
  const pediatricsDoctor = doctorIds.get('dr.pediatrics')!;
  const neurologyDoctor = doctorIds.get('dr.neurology')!;
  const rejectedDoctor = doctorIds.get('dr.rejected')!;
  const primaryPatientId = patientIds.get('patient')!;

  let count = 0;

  // --- Completed consultations, with notes and prescriptions -------------
  await createCompletedConsultation(tx, {
    patientId: primaryPatientId,
    doctorId: primaryDoctor.id,
    startsAt: pastLocalInstant(now, 14, 10, 0, primaryDoctor.fixture.timezone),
    consultationMinutes: primaryDoctor.fixture.consultationMinutes,
    reason: 'Annual check-up and blood pressure review.',
    findings: 'Blood pressure 122/78. No acute distress. Lungs clear on auscultation.',
    assessment: 'Well-controlled mild asthma; overall stable health.',
    plan: 'Continue current inhaler as needed. Routine bloodwork in 6 months.',
    patientSummary: 'Everything looks good. Keep using your inhaler only when needed, and we will check in again in 6 months.',
    prescriptions: [
      {
        medication: 'Albuterol inhaler',
        dosage: '90 mcg',
        frequency: 'As needed',
        duration: '6 months',
        instructions: 'Use before physical activity or if wheezing occurs.',
      },
    ],
  });
  count += 1;

  await createCompletedConsultation(tx, {
    patientId: primaryPatientId,
    doctorId: cardiologyDoctor.id,
    startsAt: pastLocalInstant(now, 7, 11, 0, cardiologyDoctor.fixture.timezone),
    consultationMinutes: cardiologyDoctor.fixture.consultationMinutes,
    reason: 'Follow-up on blood pressure medication.',
    findings: 'Heart rate 72 bpm regular. No murmurs. Blood pressure within target range.',
    assessment: 'Hypertension well controlled on current regimen.',
    plan: 'Continue current dosage. Re-check in 3 months; home blood pressure log recommended.',
    patientSummary: 'Your blood pressure is well managed. Keep taking your medication and log readings at home.',
    prescriptions: [
      {
        medication: 'Amlodipine',
        dosage: '5 mg',
        frequency: 'Once daily',
        duration: '3 months',
        instructions: 'Take in the morning with or without food.',
      },
    ],
  });
  count += 1;

  // --- Upcoming booked appointments, from real generated slots ------------
  // Tracks every slot already assigned to the primary patient this run, so
  // two different doctors' generated slots can never be picked for the same
  // instant (see `pickSlot`'s doc comment).
  const usedByPatient: { start: Date; end: Date }[] = [];
  function claim(slot: Slot): Slot {
    usedByPatient.push({ start: slot.start, end: slot.end });
    return slot;
  }

  const upcomingPrimarySlot = claim(pickSlot(primaryDoctor.fixture, now, 1, 14, usedByPatient));
  const upcomingPrimary = await tx.appointment.create({
    data: {
      patientId: primaryPatientId,
      doctorId: primaryDoctor.id,
      startsAt: upcomingPrimarySlot.start,
      endsAt: upcomingPrimarySlot.end,
      reason: 'Routine follow-up check-up.',
      status: AppointmentStatus.BOOKED,
    },
  });
  count += 1;

  const upcomingDermatologySlot = claim(pickSlot(dermatologyDoctor.fixture, now, 1, 14, usedByPatient));
  await tx.appointment.create({
    data: {
      patientId: primaryPatientId,
      doctorId: dermatologyDoctor.id,
      startsAt: upcomingDermatologySlot.start,
      endsAt: upcomingDermatologySlot.end,
      reason: 'Persistent rash on forearm for evaluation.',
      status: AppointmentStatus.BOOKED,
    },
  });
  count += 1;

  // Unread notifications for the primary demo patient and doctor, reusing
  // the same drafts the real booking flow creates.
  const primaryPatientFixture = DEMO_PATIENTS.find((patient) => patient.emailLocalPart === 'patient')!;
  const notificationDrafts: NotificationDraft[] = bookNotificationDrafts({
    appointmentId: upcomingPrimary.id,
    doctor: { id: primaryDoctor.id, displayName: `${primaryDoctor.fixture.firstName} ${primaryDoctor.fixture.lastName}` },
    patient: { id: primaryPatientId, displayName: `${primaryPatientFixture.firstName} ${primaryPatientFixture.lastName}` },
    startsAt: upcomingPrimarySlot.start,
  });
  await tx.notification.createMany({ data: notificationDrafts });

  // --- Cancelled appointment ----------------------------------------------
  const cancelledSlot = claim(pickSlot(obgynDoctor.fixture, now, 1, 14, usedByPatient));
  const cancelledAppointment = await tx.appointment.create({
    data: {
      patientId: primaryPatientId,
      doctorId: obgynDoctor.id,
      startsAt: cancelledSlot.start,
      endsAt: cancelledSlot.end,
      reason: 'Prenatal check-up.',
      status: AppointmentStatus.BOOKED,
    },
  });
  await tx.appointment.update({
    where: { id: cancelledAppointment.id },
    data: {
      status: AppointmentStatus.CANCELLED,
      cancelledAt: now,
      cancelledById: primaryPatientId,
      cancellationReason: 'No longer needed, feeling better.',
    },
  });
  count += 1;

  // --- Rescheduled pair -----------------------------------------------------
  const originalSlot = claim(pickSlot(pediatricsDoctor.fixture, now, 1, 14, usedByPatient));
  const originalAppointment = await tx.appointment.create({
    data: {
      patientId: primaryPatientId,
      doctorId: pediatricsDoctor.id,
      startsAt: originalSlot.start,
      endsAt: originalSlot.end,
      reason: "Child's routine wellness visit.",
      status: AppointmentStatus.BOOKED,
    },
  });
  await tx.appointment.update({
    where: { id: originalAppointment.id },
    data: {
      status: AppointmentStatus.CANCELLED,
      cancelledAt: now,
      cancelledById: primaryPatientId,
      cancellationReason: 'Rescheduled',
    },
  });
  const successorSlot = claim(pickSlot(pediatricsDoctor.fixture, now, 1, 14, usedByPatient));
  await tx.appointment.create({
    data: {
      patientId: primaryPatientId,
      doctorId: pediatricsDoctor.id,
      startsAt: successorSlot.start,
      endsAt: successorSlot.end,
      reason: originalAppointment.reason,
      rescheduledFromId: originalAppointment.id,
      status: AppointmentStatus.BOOKED,
    },
  });
  count += 2;

  // --- Invalid bookings, for the administrator to resolve ------------------
  // NOT_COMPLETED: ended in the past, never completed.
  await tx.appointment.create({
    data: {
      patientId: primaryPatientId,
      doctorId: neurologyDoctor.id,
      startsAt: new Date(now.getTime() - 150 * 60_000),
      endsAt: new Date(now.getTime() - 120 * 60_000),
      reason: 'Persistent headaches for the past two weeks.',
      status: AppointmentStatus.BOOKED,
    },
  });
  count += 1;

  // DOCTOR_UNAVAILABLE: upcoming, but the doctor is no longer visible
  // (rejected) — inserted directly, bypassing the booking service the same
  // way this whole script does, per design.md's "Invalid bookings".
  await tx.appointment.create({
    data: {
      patientId: primaryPatientId,
      doctorId: rejectedDoctor.id,
      startsAt: new Date(now.getTime() + 15 * 86_400_000),
      endsAt: new Date(now.getTime() + 15 * 86_400_000 + rejectedDoctor.fixture.consultationMinutes * 60_000),
      reason: 'Knee pain evaluation.',
      status: AppointmentStatus.BOOKED,
    },
  });
  count += 1;

  return count;
}

interface CompletedConsultationInput {
  patientId: string;
  doctorId: string;
  startsAt: Date;
  consultationMinutes: number;
  reason: string;
  findings: string;
  assessment: string;
  plan: string;
  patientSummary: string;
  prescriptions: { medication: string; dosage: string; frequency: string; duration: string; instructions?: string }[];
}

async function createCompletedConsultation(tx: Tx, input: CompletedConsultationInput): Promise<void> {
  const endsAt = new Date(input.startsAt.getTime() + input.consultationMinutes * 60_000);
  const appointment = await tx.appointment.create({
    data: {
      patientId: input.patientId,
      doctorId: input.doctorId,
      startsAt: input.startsAt,
      endsAt,
      reason: input.reason,
      status: AppointmentStatus.COMPLETED,
    },
  });
  await tx.consultationSession.create({
    data: {
      appointmentId: appointment.id,
      state: SessionState.COMPLETED,
      patientJoinedAt: input.startsAt,
      doctorJoinedAt: input.startsAt,
      startedAt: input.startsAt,
      completedAt: endsAt,
    },
  });
  await tx.consultationNote.create({
    data: {
      appointmentId: appointment.id,
      findings: input.findings,
      assessment: input.assessment,
      plan: input.plan,
      patientSummary: input.patientSummary,
    },
  });
  if (input.prescriptions.length > 0) {
    await tx.prescription.createMany({
      data: input.prescriptions.map((prescription) => ({
        appointmentId: appointment.id,
        medication: prescription.medication,
        dosage: prescription.dosage,
        frequency: prescription.frequency,
        duration: prescription.duration,
        instructions: prescription.instructions ?? null,
      })),
    });
  }
}
