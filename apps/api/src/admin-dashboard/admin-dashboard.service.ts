import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { isSupportedTimeZone } from '../common/timezone.js';
import { localCalendarDate, localMinuteToInstant } from '../availability/slot-generator.js';
import { invalidBookingWhere } from '../admin-appointments/invalid-booking.js';
import { AccountStatus, AppointmentStatus, Role, SessionState, VerificationStatus } from '../generated/prisma/enums.js';
import { computeDailyBuckets, TREND_FUTURE_DAYS, TREND_PAST_DAYS } from './dashboard-buckets.js';
import type { AdminDashboardQueryDto } from './dto/admin-dashboard-query.dto.js';
import type { AdminDashboardResponseDto } from './dto/admin-dashboard-response.dto.js';

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class AdminDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async get(query: AdminDashboardQueryDto): Promise<AdminDashboardResponseDto> {
    const timezone = query.tz ?? 'UTC';
    if (!isSupportedTimeZone(timezone)) {
      throw new BadRequestException(`Unknown time zone: ${timezone}`);
    }

    const now = new Date();
    const today = localCalendarDate(now, timezone);
    const todayStart = localMinuteToInstant(today.year, today.month, today.day, 0, timezone);
    const todayEnd = localMinuteToInstant(today.year, today.month, today.day, 1440, timezone);
    const trendFrom = new Date(todayStart.getTime() - TREND_PAST_DAYS * DAY_MS);
    const trendTo = new Date(todayEnd.getTime() + TREND_FUTURE_DAYS * DAY_MS);
    const sevenDaysAgo = new Date(now.getTime() - 7 * DAY_MS);

    const [
      patientStatusRows,
      doctorStatusRows,
      doctorVerificationRows,
      appointmentsTodayRows,
      appointmentsUpcomingRows,
      appointmentsAllTimeRows,
      consultationsInProgress,
      consultationsCompletedToday,
      consultationsCompletedLast7Days,
      pendingDoctorReviews,
      invalidBookings,
      trendAppointments,
    ] = await Promise.all([
      this.prisma.user.groupBy({ by: ['status'], where: { role: Role.PATIENT }, _count: { _all: true } }),
      this.prisma.user.groupBy({ by: ['status'], where: { role: Role.DOCTOR }, _count: { _all: true } }),
      this.prisma.doctorProfile.groupBy({ by: ['verificationStatus'], _count: { _all: true } }),
      this.prisma.appointment.groupBy({
        by: ['status'],
        where: { startsAt: { gte: todayStart, lt: todayEnd } },
        _count: { _all: true },
      }),
      this.prisma.appointment.groupBy({
        by: ['status'],
        where: { startsAt: { gt: now } },
        _count: { _all: true },
      }),
      this.prisma.appointment.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.consultationSession.count({ where: { state: SessionState.IN_PROGRESS } }),
      this.prisma.consultationSession.count({
        where: { state: SessionState.COMPLETED, completedAt: { gte: todayStart, lt: todayEnd } },
      }),
      this.prisma.consultationSession.count({
        where: { state: SessionState.COMPLETED, completedAt: { gte: sevenDaysAgo } },
      }),
      this.prisma.doctorProfile.count({ where: { verificationStatus: VerificationStatus.PENDING } }),
      this.prisma.appointment.count({ where: invalidBookingWhere(now) }),
      this.prisma.appointment.findMany({
        where: {
          startsAt: { gte: trendFrom, lt: trendTo },
          status: { in: [AppointmentStatus.BOOKED, AppointmentStatus.COMPLETED] },
        },
        select: { startsAt: true },
      }),
    ]);

    return {
      patients: accountStatusCounts(patientStatusRows),
      doctors: accountStatusCounts(doctorStatusRows),
      doctorVerification: {
        PENDING: countFor(doctorVerificationRows, 'verificationStatus', VerificationStatus.PENDING),
        APPROVED: countFor(doctorVerificationRows, 'verificationStatus', VerificationStatus.APPROVED),
        REJECTED: countFor(doctorVerificationRows, 'verificationStatus', VerificationStatus.REJECTED),
      },
      appointmentsToday: appointmentStatusCounts(appointmentsTodayRows),
      appointmentsUpcoming: appointmentStatusCounts(appointmentsUpcomingRows),
      appointmentsAllTime: appointmentStatusCounts(appointmentsAllTimeRows),
      consultationsInProgress,
      consultationsCompletedToday,
      consultationsCompletedLast7Days,
      pendingDoctorReviews,
      invalidBookings,
      trend: computeDailyBuckets(
        trendAppointments.map((a) => a.startsAt),
        timezone,
        now,
      ),
      timezone,
    };
  }
}

type GroupedCount<K extends string> = { _count: { _all: number } } & Record<K, string>;

function countFor<K extends string>(rows: GroupedCount<K>[], key: K, value: string): number {
  return rows.find((row) => row[key] === value)?._count._all ?? 0;
}

function accountStatusCounts(rows: GroupedCount<'status'>[]): { ACTIVE: number; SUSPENDED: number; DEACTIVATED: number } {
  return {
    ACTIVE: countFor(rows, 'status', AccountStatus.ACTIVE),
    SUSPENDED: countFor(rows, 'status', AccountStatus.SUSPENDED),
    DEACTIVATED: countFor(rows, 'status', AccountStatus.DEACTIVATED),
  };
}

function appointmentStatusCounts(
  rows: GroupedCount<'status'>[],
): { BOOKED: number; CANCELLED: number; COMPLETED: number; NOT_HELD: number } {
  return {
    BOOKED: countFor(rows, 'status', AppointmentStatus.BOOKED),
    CANCELLED: countFor(rows, 'status', AppointmentStatus.CANCELLED),
    COMPLETED: countFor(rows, 'status', AppointmentStatus.COMPLETED),
    NOT_HELD: countFor(rows, 'status', AppointmentStatus.NOT_HELD),
  };
}
