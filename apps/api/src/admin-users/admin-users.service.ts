import { ForbiddenException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { SessionService } from '../auth/session/session.service.js';
import { AppointmentsService } from '../appointments/appointments.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { withNotifications } from '../notifications/with-notifications.js';
import { AuditService } from '../audit/audit.service.js';
import { AuditEntityType } from '../audit/audit-entity-type.js';
import { diffFields } from '../audit/diff-fields.js';
import { DomainError } from '../common/errors/domain-error.js';
import { ErrorCode } from '../common/errors/error-codes.js';
import type { Prisma } from '../generated/prisma/client.js';
import { AccountStatus, AppointmentStatus, AuditAction, Role } from '../generated/prisma/enums.js';
import type { AdminUserListQueryDto } from './dto/admin-user-list-query.dto.js';
import type { ChangeAccountStatusDto } from './dto/change-account-status.dto.js';
import type { AdminUserListResponseDto, AdminUserResponseDto } from './dto/admin-user-response.dto.js';

type UserWithProfiles = Prisma.UserGetPayload<{ include: typeof WITH_PROFILES }>;

const WITH_PROFILES = {
  patientProfile: { select: { firstName: true, lastName: true } },
  doctorProfile: { select: { firstName: true, lastName: true } },
} satisfies Prisma.UserInclude;

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionService: SessionService,
    private readonly appointmentsService: AppointmentsService,
    private readonly notificationsService: NotificationsService,
    private readonly auditService: AuditService,
  ) {}

  async list(query: AdminUserListQueryDto): Promise<AdminUserListResponseDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const q = query.q?.trim();

    const where: Prisma.UserWhereInput = {
      ...(query.role ? { role: query.role } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(q
        ? {
            OR: [
              { email: { contains: q, mode: 'insensitive' } },
              { patientProfile: { is: { OR: [{ firstName: { contains: q, mode: 'insensitive' } }, { lastName: { contains: q, mode: 'insensitive' } }] } } },
              { doctorProfile: { is: { OR: [{ firstName: { contains: q, mode: 'insensitive' } }, { lastName: { contains: q, mode: 'insensitive' } }] } } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: WITH_PROFILES,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);

    const counts = await this.upcomingAppointmentCounts(items);

    return {
      items: items.map((user) => this.toDto(user, counts.get(user.id) ?? 0)),
      total,
      page,
      pageSize,
    };
  }

  /**
   * Runs in one transaction (see design.md's "Status changes reuse domain
   * services"): the status update, every cancelled appointment, and the
   * audit entry commit or roll back together. Session revocation happens
   * right after commit, through `SessionService`'s existing revoke path
   * (which also disconnects sockets) — it isn't itself transactional, the
   * same way notification delivery isn't.
   */
  async changeStatus(
    adminId: string,
    targetUserId: string,
    dto: ChangeAccountStatusDto,
  ): Promise<AdminUserResponseDto> {
    const reason = dto.reason.trim();

    const { result, notifications } = await withNotifications(
      this.prisma,
      this.notificationsService,
      async (tx, notify) => {
        const user = await tx.user.findUnique({ where: { id: targetUserId }, include: WITH_PROFILES });
        if (!user) {
          throw new NotFoundException('Account not found');
        }
        if (user.role === Role.ADMIN) {
          throw new ForbiddenException('Administrator accounts cannot be changed through this endpoint');
        }
        if (user.status === dto.status) {
          throw new DomainError(HttpStatus.CONFLICT, ErrorCode.STATUS_UNCHANGED, 'The account already has this status.');
        }

        const before = { status: user.status, statusReason: user.statusReason };
        const updated = await tx.user.update({
          where: { id: targetUserId },
          data: { status: dto.status, statusReason: reason },
          include: WITH_PROFILES,
        });

        const cancelledAppointmentIds: string[] = [];
        if (dto.status === AccountStatus.DEACTIVATED) {
          const upcoming = await tx.appointment.findMany({
            where: {
              status: AppointmentStatus.BOOKED,
              endsAt: { gt: new Date() },
              OR: [{ patientId: targetUserId }, { doctorId: targetUserId }],
            },
          });
          for (const appointment of upcoming) {
            const cancelled = await this.appointmentsService.cancelInTx(
              tx,
              appointment,
              { cancelledById: adminId, reason: `Account deactivated: ${reason}`, kind: 'platform' },
              notify,
            );
            cancelledAppointmentIds.push(cancelled.id);
          }
        }

        const diff = diffFields(before, { status: updated.status, statusReason: updated.statusReason }, [
          'status',
          'statusReason',
        ]);
        await this.auditService.record(tx, {
          actorId: adminId,
          action: AuditAction.USER_STATUS_CHANGED,
          entityType: AuditEntityType.USER,
          entityId: targetUserId,
          reason,
          before: diff.before,
          after: cancelledAppointmentIds.length > 0 ? { ...diff.after, cancelledAppointmentIds } : diff.after,
        });

        return { updated, cancelledCount: cancelledAppointmentIds.length };
      },
    );

    if (dto.status !== AccountStatus.ACTIVE) {
      await this.sessionService.revokeAllSessions(targetUserId);
    }
    await this.notificationsService.publish(notifications);

    return this.toDto(result.updated, await this.countUpcomingAppointments(result.updated));
  }

  private async upcomingAppointmentCounts(users: UserWithProfiles[]): Promise<Map<string, number>> {
    const now = new Date();
    const patientIds = users.filter((u) => u.role === Role.PATIENT).map((u) => u.id);
    const doctorIds = users.filter((u) => u.role === Role.DOCTOR).map((u) => u.id);
    const counts = new Map<string, number>();

    if (patientIds.length > 0) {
      const grouped = await this.prisma.appointment.groupBy({
        by: ['patientId'],
        where: { patientId: { in: patientIds }, status: AppointmentStatus.BOOKED, endsAt: { gt: now } },
        _count: { _all: true },
      });
      for (const row of grouped) counts.set(row.patientId, row._count._all);
    }
    if (doctorIds.length > 0) {
      const grouped = await this.prisma.appointment.groupBy({
        by: ['doctorId'],
        where: { doctorId: { in: doctorIds }, status: AppointmentStatus.BOOKED, endsAt: { gt: now } },
        _count: { _all: true },
      });
      for (const row of grouped) counts.set(row.doctorId, row._count._all);
    }
    return counts;
  }

  private async countUpcomingAppointments(user: { id: string; role: Role }): Promise<number> {
    if (user.role !== Role.PATIENT && user.role !== Role.DOCTOR) return 0;
    const now = new Date();
    const where: Prisma.AppointmentWhereInput =
      user.role === Role.PATIENT
        ? { patientId: user.id, status: AppointmentStatus.BOOKED, endsAt: { gt: now } }
        : { doctorId: user.id, status: AppointmentStatus.BOOKED, endsAt: { gt: now } };
    return this.prisma.appointment.count({ where });
  }

  private toDto(user: UserWithProfiles, upcomingAppointmentCount: number): AdminUserResponseDto {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      statusReason: user.statusReason,
      displayName: displayName(user),
      createdAt: user.createdAt.toISOString(),
      lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
      upcomingAppointmentCount,
    };
  }
}

function displayName(user: UserWithProfiles): string {
  if (user.patientProfile) return `${user.patientProfile.firstName} ${user.patientProfile.lastName}`;
  if (user.doctorProfile) return `${user.doctorProfile.firstName} ${user.doctorProfile.lastName}`;
  return 'Administrator';
}
