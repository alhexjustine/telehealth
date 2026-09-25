import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { DEMO_DOMAIN } from './constants.js';

export interface ResetResult {
  deletedUsers: number;
}

/**
 * Removes every demo account and every record owned by them, leaving
 * non-demo accounts and data untouched — see the `demo-data` spec's "Demo
 * data reset". Safe to run against a database that also holds real data:
 * only rows reachable from a `@demo.telehealth.local` user are touched, and
 * audit log entries are append-only and are deliberately kept (see
 * design.md's "Reset").
 */
export async function resetDemoData(prisma: PrismaClient): Promise<ResetResult> {
  const demoUsers = await prisma.user.findMany({
    where: { email: { endsWith: `@${DEMO_DOMAIN}` } },
    select: { id: true },
  });
  const demoUserIds = demoUsers.map((user) => user.id);

  if (demoUserIds.length === 0) {
    console.log('No demo accounts found; nothing to reset.');
    return { deletedUsers: 0 };
  }

  await prisma.$transaction(
    async (tx) => {
      // Appointments where EITHER side is a demo account go first, in case a
      // non-demo user booked with a demo doctor (or a demo patient booked a
      // non-demo doctor): deleting the `User` rows below would otherwise
      // fail on `Appointment.patientId`/`doctorId`'s foreign keys for
      // whichever side is non-demo.
      await tx.appointment.deleteMany({
        where: { OR: [{ patientId: { in: demoUserIds } }, { doctorId: { in: demoUserIds } }] },
      });
      // Deleting the demo users cascades to everything else scoped to them —
      // sessions, profiles, availability rules/exceptions, notifications
      // (schema.prisma's `onDelete: Cascade` on each relation). Audit log
      // rows reference `actorId` with no cascade and are append-only by a
      // database trigger, so they're never touched here.
      await tx.user.deleteMany({ where: { id: { in: demoUserIds } } });
    },
    { maxWait: 15_000, timeout: 60_000 },
  );

  console.log(`Reset removed ${demoUserIds.length} demo account(s) and their records. Audit log entries were kept.`);
  return { deletedUsers: demoUserIds.length };
}
