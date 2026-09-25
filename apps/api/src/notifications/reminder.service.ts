import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';
import { AppointmentStatus, NotificationType } from '../generated/prisma/enums.js';
import { Prisma, type Notification } from '../generated/prisma/client.js';
import { NotificationsService } from './notifications.service.js';
import type { NotificationDraft } from './notification.types.js';

interface ReminderWindow {
  type: typeof NotificationType.REMINDER_24H | typeof NotificationType.REMINDER_1H;
  key: '24h' | '1h';
  label: string;
  hours: number;
}

const WINDOWS: readonly ReminderWindow[] = [
  { type: NotificationType.REMINDER_24H, key: '24h', label: 'Starts in 24 hours', hours: 24 },
  { type: NotificationType.REMINDER_1H, key: '1h', label: 'Starts in 1 hour', hours: 1 },
];

type AppointmentWithParties = Prisma.AppointmentGetPayload<{
  include: { doctor: true; patient: true };
}>;

/**
 * Creates the 24h/1h reminders required by the `notifications` spec. Runs
 * every minute (see design.md's "Reminder job") — cheap, and well inside the
 * 5-minute delivery bound. `run(now)` is public and takes an injected clock
 * so tests can call it directly instead of waiting on the cron; the cron
 * itself is disabled by `REMINDERS_ENABLED=false` in tests, CI, and OpenAPI
 * generation: `NotificationsModule` only registers this provider (and
 * `ScheduleModule`) when the flag is on, so no timer keeps the process alive.
 */
@Injectable()
export class ReminderService {
  private readonly logger = new Logger(ReminderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron('*/1 * * * *')
  async handleCron(): Promise<void> {
    await this.run(new Date());
  }

  async run(now: Date): Promise<void> {
    for (const window of WINDOWS) {
      await this.runWindow(window, now);
    }
  }

  private async runWindow(window: ReminderWindow, now: Date): Promise<void> {
    // The window has begun: `startsAt - hours <= now`, rearranged to an
    // indexed range query on `startsAt` (see design.md's "Reminder job").
    const upperBound = new Date(now.getTime() + window.hours * 3_600_000);
    const candidates = await this.prisma.appointment.findMany({
      where: { status: AppointmentStatus.BOOKED, startsAt: { gt: now, lte: upperBound } },
      include: { doctor: true, patient: true },
    });

    const created: Notification[] = [];
    for (const appointment of candidates) {
      // Skip a window that had already begun when the appointment was
      // booked (`createdAt <= startsAt - hours`, i.e. short-notice bookings).
      const windowOpenedAt = appointment.startsAt.getTime() - window.hours * 3_600_000;
      if (appointment.createdAt.getTime() > windowOpenedAt) continue;

      for (const draft of this.draftsFor(window, appointment)) {
        const row = await this.tryCreate(draft);
        if (row) created.push(row);
      }
    }

    await this.notifications.publish(created);
  }

  private draftsFor(window: ReminderWindow, appointment: AppointmentWithParties): NotificationDraft[] {
    const doctorName = `Dr. ${appointment.doctor.firstName} ${appointment.doctor.lastName}`;
    const patientName = `${appointment.patient.firstName} ${appointment.patient.lastName}`;
    const startsAt = appointment.startsAt.toISOString();

    return [
      {
        userId: appointment.doctorId,
        type: window.type,
        title: window.label,
        body: `Appointment with ${patientName} ${window.label.toLowerCase()}`,
        data: { startsAt, counterpartName: patientName },
        link: `/doctor/appointments/${appointment.id}`,
        appointmentId: appointment.id,
        dedupeKey: `reminder:${window.key}:${appointment.id}:${appointment.doctorId}`,
      },
      {
        userId: appointment.patientId,
        type: window.type,
        title: window.label,
        body: `Appointment with ${doctorName} ${window.label.toLowerCase()}`,
        data: { startsAt, counterpartName: doctorName },
        link: `/patient/appointments/${appointment.id}`,
        appointmentId: appointment.id,
        dedupeKey: `reminder:${window.key}:${appointment.id}:${appointment.patientId}`,
      },
    ];
  }

  /** `skipDuplicates` isn't available with individual `create`s; catching the unique violation on `dedupeKey` is the per-row equivalent (see design.md's "Reminder job"). */
  private async tryCreate(draft: NotificationDraft): Promise<Notification | null> {
    try {
      return await this.prisma.notification.create({ data: draft });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return null;
      }
      throw error;
    }
  }
}
