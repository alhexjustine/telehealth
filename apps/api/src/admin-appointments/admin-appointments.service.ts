import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AppointmentsService } from '../appointments/appointments.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { withNotifications } from '../notifications/with-notifications.js';
import { AuditService } from '../audit/audit.service.js';
import { AuditEntityType } from '../audit/audit-entity-type.js';
import { DomainError } from '../common/errors/domain-error.js';
import { ErrorCode } from '../common/errors/error-codes.js';
import type { Prisma } from '../generated/prisma/client.js';
import { AppointmentStatus, AuditAction, SessionState } from '../generated/prisma/enums.js';
import { computeInvalidBookingFlags, invalidBookingWhere, isNotCompleted } from './invalid-booking.js';
import type { AdminAppointmentListQueryDto } from './dto/admin-appointment-list-query.dto.js';
import type { AdminCancelAppointmentDto } from './dto/admin-cancel-appointment.dto.js';
import type { MarkNotHeldDto } from './dto/mark-not-held.dto.js';
import type {
  AdminAppointmentListResponseDto,
  AdminAppointmentResponseDto,
} from './dto/admin-appointment-response.dto.js';

const WITH_RELATIONS = {
  doctor: { include: { user: { select: { status: true } } } },
  patient: true,
  dependent: true,
  consultationSession: true,
} satisfies Prisma.AppointmentInclude;

type AppointmentWithRelations = Prisma.AppointmentGetPayload<{ include: typeof WITH_RELATIONS }>;

@Injectable()
export class AdminAppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly appointmentsService: AppointmentsService,
    private readonly notificationsService: NotificationsService,
    private readonly auditService: AuditService,
  ) {}

  async list(query: AdminAppointmentListQueryDto): Promise<AdminAppointmentListResponseDto> {
    const now = new Date();
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.AppointmentWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.doctorId ? { doctorId: query.doctorId } : {}),
      ...(query.patientId ? { patientId: query.patientId } : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            startsAt: {
              ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
              ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
            },
          }
        : {}),
      ...(query.consultationState
        ? {
            consultationSession:
              query.consultationState === SessionState.SCHEDULED
                ? { is: null }
                : { is: { state: query.consultationState } },
          }
        : {}),
      ...(query.invalidOnly ? invalidBookingWhere(now) : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.appointment.findMany({
        where,
        include: WITH_RELATIONS,
        orderBy: { startsAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.appointment.count({ where }),
    ]);

    return { items: items.map((item) => this.toDto(item, now)), total, page, pageSize };
  }

  async detail(appointmentId: string): Promise<AdminAppointmentResponseDto> {
    const appointment = await this.load(appointmentId);
    return this.toDto(appointment, new Date());
  }

  async cancel(adminId: string, appointmentId: string, dto: AdminCancelAppointmentDto): Promise<AdminAppointmentResponseDto> {
    const now = new Date();
    const appointment = await this.load(appointmentId);
    if (appointment.status !== AppointmentStatus.BOOKED || appointment.endsAt.getTime() <= now.getTime()) {
      throw new DomainError(
        HttpStatus.CONFLICT,
        ErrorCode.APPOINTMENT_NOT_CANCELLABLE,
        'This appointment can no longer be cancelled.',
      );
    }

    const reason = dto.reason.trim();
    const { notifications } = await withNotifications(this.prisma, this.notificationsService, async (tx, notify) => {
      await this.appointmentsService.cancelInTx(tx, appointment, { cancelledById: adminId, reason, kind: 'platform' }, notify);
      await this.auditService.record(tx, {
        actorId: adminId,
        action: AuditAction.APPOINTMENT_CANCELLED,
        entityType: AuditEntityType.APPOINTMENT,
        entityId: appointmentId,
        reason,
        before: { status: appointment.status },
        after: { status: AppointmentStatus.CANCELLED },
      });
    });

    await this.notificationsService.publish(notifications);
    return this.toDto(await this.load(appointmentId), new Date());
  }

  async markNotHeld(adminId: string, appointmentId: string, dto: MarkNotHeldDto): Promise<AdminAppointmentResponseDto> {
    const now = new Date();
    const appointment = await this.load(appointmentId);
    if (!isNotCompleted(appointment, now)) {
      throw new DomainError(
        HttpStatus.CONFLICT,
        ErrorCode.NOT_ELIGIBLE_FOR_NOT_HELD,
        'This appointment is not eligible to be marked not held.',
      );
    }

    const reason = dto.reason.trim();
    await this.prisma.$transaction(async (tx) => {
      await tx.appointment.update({
        where: { id: appointmentId },
        data: { status: AppointmentStatus.NOT_HELD, resolutionReason: reason },
      });
      await this.auditService.record(tx, {
        actorId: adminId,
        action: AuditAction.APPOINTMENT_MARKED_NOT_HELD,
        entityType: AuditEntityType.APPOINTMENT,
        entityId: appointmentId,
        reason,
        before: { status: appointment.status },
        after: { status: AppointmentStatus.NOT_HELD },
      });
    });

    return this.toDto(await this.load(appointmentId), new Date());
  }

  private async load(appointmentId: string): Promise<AppointmentWithRelations> {
    const appointment = await this.prisma.appointment.findUnique({ where: { id: appointmentId }, include: WITH_RELATIONS });
    if (!appointment) throw new NotFoundException('Appointment not found');
    return appointment;
  }

  private toDto(appointment: AppointmentWithRelations, now: Date): AdminAppointmentResponseDto {
    const flags = computeInvalidBookingFlags(
      {
        status: appointment.status,
        startsAt: appointment.startsAt,
        endsAt: appointment.endsAt,
        doctor: { verificationStatus: appointment.doctor.verificationStatus, accountStatus: appointment.doctor.user.status },
      },
      now,
    );

    return {
      id: appointment.id,
      startsAt: appointment.startsAt.toISOString(),
      endsAt: appointment.endsAt.toISOString(),
      status: appointment.status,
      doctor: { id: appointment.doctorId, displayName: `${appointment.doctor.firstName} ${appointment.doctor.lastName}` },
      patient: { id: appointment.patientId, displayName: `${appointment.patient.firstName} ${appointment.patient.lastName}` },
      dependent: appointment.dependent
        ? {
            id: appointment.dependent.id,
            displayName: `${appointment.dependent.firstName} ${appointment.dependent.lastName}`,
            relationship: appointment.dependent.relationship,
          }
        : null,
      consultationState: appointment.consultationSession?.state ?? SessionState.SCHEDULED,
      flags,
      cancelledAt: appointment.cancelledAt ? appointment.cancelledAt.toISOString() : null,
      cancelledByRole: cancelledByRole(appointment),
      cancellationReason: appointment.cancellationReason,
      resolutionReason: appointment.resolutionReason,
    };
  }
}

function cancelledByRole(appointment: {
  cancelledById: string | null;
  patientId: string;
  doctorId: string;
}): 'PATIENT' | 'DOCTOR' | 'ADMIN' | null {
  if (!appointment.cancelledById) return null;
  if (appointment.cancelledById === appointment.patientId) return 'PATIENT';
  if (appointment.cancelledById === appointment.doctorId) return 'DOCTOR';
  return 'ADMIN';
}
