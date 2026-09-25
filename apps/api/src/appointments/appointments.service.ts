import { BadRequestException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { AppointmentStatus, Role } from '../generated/prisma/enums.js';
import { ageAt } from '../matching/age.js';
import { DomainError } from '../common/errors/domain-error.js';
import { ErrorCode } from '../common/errors/error-codes.js';
import {
  EXCLUSION_CONSTRAINT_SQLSTATE,
  postgresConstraintName,
  postgresErrorCode,
} from '../common/errors/postgres-error.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { withNotifications } from '../notifications/with-notifications.js';
import {
  bookNotificationDrafts,
  cancelNotificationDrafts,
  platformCancelNotificationDrafts,
  rescheduleNotificationDrafts,
} from '../notifications/appointment-notifications.js';
import type { NotificationDraft } from '../notifications/notification.types.js';
import { BookingRules } from './booking-rules.js';
import { RESCHEDULE_CUTOFF_MINUTES } from './booking.constants.js';
import type { CreateAppointmentDto } from './dto/create-appointment.dto.js';
import type { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto.js';
import type { CancelAppointmentDto } from './dto/cancel-appointment.dto.js';
import type { AppointmentScope } from './dto/appointment-list-query.dto.js';
import type {
  AppointmentDetailResponseDto,
  AppointmentHistoryEntryDto,
  AppointmentListResponseDto,
  AppointmentResponseDto,
} from './dto/appointment-response.dto.js';

export interface AppointmentCaller {
  id: string;
  role: Role;
}

const DOCTOR_OVERLAP_CONSTRAINT = 'appointments_doctor_no_overlap';
const PATIENT_OVERLAP_CONSTRAINT = 'appointments_patient_no_overlap';

const WITH_RELATIONS = {
  doctor: {
    include: {
      specializations: { include: { specialization: true } },
      user: { select: { status: true } },
    },
  },
  patient: { include: { user: { select: { status: true } } } },
  symptoms: { include: { symptom: true } },
} satisfies Prisma.AppointmentInclude;

export type AppointmentWithRelations = Prisma.AppointmentGetPayload<{ include: typeof WITH_RELATIONS }>;

export type CancellationKind =
  /** The patient or doctor cancelling their own appointment (existing behavior: only the counterpart is notified). */
  | 'participant'
  /** An administrator cancelling directly, or a cascade from deactivating a participant's account (design.md's "Status changes reuse domain services"): every still-active participant is notified that the platform cancelled it. */
  | 'platform';

export interface CancelInTxParams {
  cancelledById: string;
  reason: string | null;
  kind: CancellationKind;
}

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bookingRules: BookingRules,
    private readonly notificationsService: NotificationsService,
  ) {}

  async book(patientId: string, dto: CreateAppointmentDto): Promise<AppointmentResponseDto> {
    const startsAt = new Date(dto.startsAt);
    const now = new Date();
    const symptomIds = await this.validateSymptomIds(dto.symptomIds);

    const { result: created, notifications } = await withNotifications(
      this.prisma,
      this.notificationsService,
      async (tx, notify) => {
        const { endsAt } = await this.bookingRules.assertBookable(tx, {
          patientId,
          doctorId: dto.doctorId,
          startsAt,
          now,
        });

        let appointment: AppointmentWithRelations;
        try {
          appointment = await tx.appointment.create({
            data: {
              patientId,
              doctorId: dto.doctorId,
              startsAt,
              endsAt,
              reason: dto.reason,
              symptoms:
                symptomIds.length > 0 ? { create: symptomIds.map((symptomId) => ({ symptomId })) } : undefined,
            },
            include: WITH_RELATIONS,
          });
        } catch (error) {
          throw this.mapOverlapError(error);
        }

        await notify(bookNotificationDrafts({
          appointmentId: appointment.id,
          doctor: participant(appointment.doctorId, appointment.doctor),
          patient: participant(appointment.patientId, appointment.patient),
          startsAt: appointment.startsAt,
        }));

        return appointment;
      },
    );

    await this.notificationsService.publish(notifications);
    return this.toResponseDto(created);
  }

  async reschedule(
    patientId: string,
    appointmentId: string,
    dto: RescheduleAppointmentDto,
  ): Promise<AppointmentResponseDto> {
    const newStartsAt = new Date(dto.startsAt);
    const now = new Date();

    const { result: rescheduled, notifications } = await withNotifications(
      this.prisma,
      this.notificationsService,
      async (tx, notify) => {
        const original = await tx.appointment.findUnique({ where: { id: appointmentId } });
        if (!original || original.patientId !== patientId) {
          throw new NotFoundException('Appointment not found');
        }

        const minutesUntilStart = (original.startsAt.getTime() - now.getTime()) / 60_000;
        if (original.status !== AppointmentStatus.BOOKED || minutesUntilStart < RESCHEDULE_CUTOFF_MINUTES) {
          throw new DomainError(
            HttpStatus.CONFLICT,
            ErrorCode.RESCHEDULE_WINDOW_CLOSED,
            `Rescheduling closes ${RESCHEDULE_CUTOFF_MINUTES / 60} hours before the appointment starts.`,
          );
        }

        const { endsAt } = await this.bookingRules.assertBookable(tx, {
          patientId: original.patientId,
          doctorId: original.doctorId,
          startsAt: newStartsAt,
          now,
          excludeAppointmentId: original.id,
        });

        // Cancel the original before inserting the new row: the exclusion
        // constraints only apply to BOOKED rows, so this is what lets the new
        // row reuse a time range that touches or overlaps the old one (see
        // design.md's "Exclusion constraints in raw SQL"). This internal
        // cancel never notifies — the reschedule notifications below cover it.
        await tx.appointment.update({
          where: { id: original.id },
          data: {
            status: AppointmentStatus.CANCELLED,
            cancelledAt: now,
            cancelledById: patientId,
            cancellationReason: 'Rescheduled',
          },
        });

        const carriedSymptoms = await tx.appointmentSymptom.findMany({ where: { appointmentId: original.id } });

        let appointment: AppointmentWithRelations;
        try {
          appointment = await tx.appointment.create({
            data: {
              patientId: original.patientId,
              doctorId: original.doctorId,
              startsAt: newStartsAt,
              endsAt,
              reason: original.reason,
              rescheduledFromId: original.id,
              symptoms:
                carriedSymptoms.length > 0
                  ? { create: carriedSymptoms.map((s) => ({ symptomId: s.symptomId })) }
                  : undefined,
            },
            include: WITH_RELATIONS,
          });
        } catch (error) {
          throw this.mapOverlapError(error);
        }

        await notify(rescheduleNotificationDrafts({
          newAppointmentId: appointment.id,
          doctor: participant(appointment.doctorId, appointment.doctor),
          patient: participant(appointment.patientId, appointment.patient),
          startsAt: appointment.startsAt,
          previousStartsAt: original.startsAt,
        }));

        return appointment;
      },
    );

    await this.notificationsService.publish(notifications);
    return this.toResponseDto(rescheduled);
  }

  async cancel(
    caller: AppointmentCaller,
    appointmentId: string,
    dto: CancelAppointmentDto,
  ): Promise<AppointmentResponseDto> {
    const now = new Date();
    const appointment = await this.prisma.appointment.findUnique({ where: { id: appointmentId } });
    if (!appointment || !this.isParticipant(caller, appointment)) {
      throw new NotFoundException('Appointment not found');
    }

    if (caller.role === Role.DOCTOR) {
      const reason = dto.reason?.trim();
      if (!reason || reason.length < 5) {
        throw new BadRequestException('A cancellation reason of at least 5 characters is required');
      }
    }

    if (appointment.status !== AppointmentStatus.BOOKED || appointment.startsAt.getTime() <= now.getTime()) {
      throw new DomainError(
        HttpStatus.CONFLICT,
        ErrorCode.APPOINTMENT_NOT_CANCELLABLE,
        'This appointment can no longer be cancelled.',
      );
    }

    const { result: updated, notifications } = await withNotifications(
      this.prisma,
      this.notificationsService,
      async (tx, notify) =>
        this.cancelInTx(
          tx,
          appointment,
          { cancelledById: caller.id, reason: dto.reason?.trim() || null, kind: 'participant' },
          notify,
        ),
    );

    await this.notificationsService.publish(notifications);
    return this.toResponseDto(updated);
  }

  /**
   * The one place that cancels an appointment row: sets it `CANCELLED` and
   * stages the matching notifications, inside a transaction the caller
   * already owns. Shared by the patient/doctor self-cancel path above and
   * by admin cancellation and account-deactivation cascades (`AdminUsersService`,
   * `AdminAppointmentsService`) so the mutation and its notification rules
   * can't drift between the three call sites — see design.md's "Status
   * changes reuse domain services".
   */
  async cancelInTx(
    tx: Prisma.TransactionClient,
    appointment: { id: string },
    params: CancelInTxParams,
    notify: (drafts: NotificationDraft[]) => Promise<void>,
  ): Promise<AppointmentWithRelations> {
    const cancelled = await tx.appointment.update({
      where: { id: appointment.id },
      data: {
        status: AppointmentStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelledById: params.cancelledById,
        cancellationReason: params.reason,
      },
      include: WITH_RELATIONS,
    });

    const doctor = participant(cancelled.doctorId, cancelled.doctor);
    const patient = participant(cancelled.patientId, cancelled.patient);

    const drafts: NotificationDraft[] =
      params.kind === 'participant'
        ? cancelNotificationDrafts({
            appointmentId: cancelled.id,
            doctor,
            patient,
            cancelledById: params.cancelledById,
            cancellationReason: cancelled.cancellationReason,
          })
        : platformCancelNotificationDrafts({
            appointmentId: cancelled.id,
            doctor: { ...doctor, isActive: cancelled.doctor.user.status === 'ACTIVE' },
            patient: { ...patient, isActive: cancelled.patient.user.status === 'ACTIVE' },
            reason: cancelled.cancellationReason,
          });

    await notify(drafts);
    return cancelled;
  }

  async list(
    caller: AppointmentCaller,
    scope: AppointmentScope,
    page: number,
    pageSize: number,
  ): Promise<AppointmentListResponseDto> {
    const now = new Date();
    const roleWhere: Prisma.AppointmentWhereInput =
      caller.role === Role.PATIENT ? { patientId: caller.id } : { doctorId: caller.id };
    const scopeWhere: Prisma.AppointmentWhereInput =
      scope === 'upcoming'
        ? { status: AppointmentStatus.BOOKED, endsAt: { gt: now } }
        : { OR: [{ status: { not: AppointmentStatus.BOOKED } }, { endsAt: { lte: now } }] };
    const where: Prisma.AppointmentWhereInput = { AND: [roleWhere, scopeWhere] };
    const orderBy: Prisma.AppointmentOrderByWithRelationInput = { startsAt: scope === 'upcoming' ? 'asc' : 'desc' };

    const [items, total] = await Promise.all([
      this.prisma.appointment.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: WITH_RELATIONS,
      }),
      this.prisma.appointment.count({ where }),
    ]);

    return { items: items.map((item) => this.toResponseDto(item)), total, page, pageSize };
  }

  async detail(caller: AppointmentCaller, appointmentId: string): Promise<AppointmentDetailResponseDto> {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: WITH_RELATIONS,
    });
    if (!appointment || !this.isParticipant(caller, appointment)) {
      throw new NotFoundException('Appointment not found');
    }

    const history = await this.buildHistory(appointment);
    const reverse = await this.prisma.appointment.findFirst({ where: { rescheduledFromId: appointment.id } });

    return {
      ...this.toResponseDto(appointment),
      rescheduledToId: reverse?.id ?? null,
      history,
    };
  }

  private isParticipant(caller: AppointmentCaller, appointment: { patientId: string; doctorId: string }): boolean {
    if (caller.role === Role.PATIENT) return appointment.patientId === caller.id;
    if (caller.role === Role.DOCTOR) return appointment.doctorId === caller.id;
    return false;
  }

  private async validateSymptomIds(symptomIds: string[] | undefined): Promise<string[]> {
    const ids = [...new Set(symptomIds ?? [])];
    if (ids.length === 0) return ids;
    const validCount = await this.prisma.symptom.count({ where: { id: { in: ids } } });
    if (validCount !== ids.length) {
      throw new BadRequestException('One or more symptom IDs are not in the catalog');
    }
    return ids;
  }

  /**
   * A `23P01` exclusion-constraint violation from the insert (the database's
   * final guard against a race between `BookingRules.assertBookable` and the
   * insert — see "Concurrent bookings of the same slot") is translated to
   * the same stable code a pre-insert check would have produced, keyed off
   * which constraint fired. Any other error is rethrown unchanged for the
   * global filter's generic handling.
   */
  private mapOverlapError(error: unknown): unknown {
    if (postgresErrorCode(error) !== EXCLUSION_CONSTRAINT_SQLSTATE) return error;
    const constraintName = postgresConstraintName(error);
    if (constraintName === DOCTOR_OVERLAP_CONSTRAINT) {
      return new DomainError(HttpStatus.CONFLICT, ErrorCode.SLOT_UNAVAILABLE, 'That slot is no longer available.');
    }
    if (constraintName === PATIENT_OVERLAP_CONSTRAINT) {
      return new DomainError(
        HttpStatus.CONFLICT,
        ErrorCode.PATIENT_CONFLICT,
        'This overlaps another of your own appointments.',
      );
    }
    return error;
  }

  private async buildHistory(appointment: AppointmentWithRelations): Promise<AppointmentHistoryEntryDto[]> {
    type ChainLink = { id: string; startsAt: Date; endsAt: Date; status: AppointmentStatus; cancelledAt: Date | null; cancellationReason: string | null; rescheduledFromId: string | null };
    const chain: ChainLink[] = [appointment];

    let cursor: ChainLink = appointment;
    while (cursor.rescheduledFromId) {
      const previous = await this.prisma.appointment.findUnique({ where: { id: cursor.rescheduledFromId } });
      if (!previous) break;
      chain.unshift(previous);
      cursor = previous;
    }

    cursor = appointment;
    // Walks forward until no successor is found.
    while (true) {
      const next = await this.prisma.appointment.findFirst({ where: { rescheduledFromId: cursor.id } });
      if (!next) break;
      chain.push(next);
      cursor = next;
    }

    return chain.map((link) => ({
      id: link.id,
      startsAt: link.startsAt.toISOString(),
      endsAt: link.endsAt.toISOString(),
      status: link.status,
      cancelledAt: link.cancelledAt ? link.cancelledAt.toISOString() : null,
      cancellationReason: link.cancellationReason,
    }));
  }

  private toResponseDto(appointment: AppointmentWithRelations): AppointmentResponseDto {
    const now = new Date();
    return {
      id: appointment.id,
      startsAt: appointment.startsAt.toISOString(),
      endsAt: appointment.endsAt.toISOString(),
      status: appointment.status,
      reason: appointment.reason,
      doctor: {
        id: appointment.doctorId,
        displayName: `${appointment.doctor.firstName} ${appointment.doctor.lastName}`,
        specializations: appointment.doctor.specializations.map((link) => ({
          id: link.specialization.id,
          name: link.specialization.name,
        })),
      },
      patient: {
        id: appointment.patientId,
        displayName: `${appointment.patient.firstName} ${appointment.patient.lastName}`,
        age: appointment.patient.birthDate ? ageAt(appointment.patient.birthDate, now) : null,
      },
      symptoms: appointment.symptoms.map((link) => ({ id: link.symptom.id, name: link.symptom.name })),
      cancelledAt: appointment.cancelledAt ? appointment.cancelledAt.toISOString() : null,
      cancellationReason: appointment.cancellationReason,
      cancelledByRole: cancelledByRole(appointment),
      rescheduledFromId: appointment.rescheduledFromId,
    };
  }
}

/** `{ id, displayName }` for the notification recipient-rules module, from either side of an `AppointmentWithRelations`. */
function participant(id: string, profile: { firstName: string; lastName: string }): { id: string; displayName: string } {
  return { id, displayName: `${profile.firstName} ${profile.lastName}` };
}

function cancelledByRole(appointment: {
  cancelledById: string | null;
  patientId: string;
  doctorId: string;
}): 'PATIENT' | 'DOCTOR' | null {
  if (!appointment.cancelledById) return null;
  if (appointment.cancelledById === appointment.patientId) return 'PATIENT';
  if (appointment.cancelledById === appointment.doctorId) return 'DOCTOR';
  return null;
}
