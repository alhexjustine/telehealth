import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { DependentRelationship, RefillRequestStatus } from '../generated/prisma/enums.js';
import { ageAt } from '../matching/age.js';
import { DomainError } from '../common/errors/domain-error.js';
import { ErrorCode } from '../common/errors/error-codes.js';
import { ClinicalAccessPolicy, hasTreatingRelationship, type ClinicalActor } from '../consultations/clinical-access-policy.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { withNotifications } from '../notifications/with-notifications.js';
import { refillDecidedNotificationDraft, refillRequestedNotificationDraft } from '../notifications/refill-notifications.js';
import type { RequestRefillDto } from './dto/request-refill.dto.js';
import type { DecideRefillDto } from './dto/decide-refill.dto.js';
import type { RefillRequestListResponseDto, RefillRequestResponseDto } from './dto/refill-request-response.dto.js';

const WITH_CONTEXT = {
  prescription: {
    include: {
      appointment: { include: { patient: true, dependent: true } },
    },
  },
} satisfies Prisma.PrescriptionRefillRequestInclude;

type RefillRequestWithContext = Prisma.PrescriptionRefillRequestGetPayload<{ include: typeof WITH_CONTEXT }>;

@Injectable()
export class RefillsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async request(
    actor: ClinicalActor,
    appointmentId: string,
    prescriptionId: string,
    dto: RequestRefillDto,
  ): Promise<RefillRequestResponseDto> {
    const prescription = await this.loadPrescriptionWithAppointment(appointmentId, prescriptionId);
    ClinicalAccessPolicy.assertCanPatientReadRecord(actor, prescription.appointment);

    const requesterName = prescription.appointment.dependent
      ? `${prescription.appointment.dependent.firstName} ${prescription.appointment.dependent.lastName}`
      : `${prescription.appointment.patient.firstName} ${prescription.appointment.patient.lastName}`;

    const { result, notifications } = await withNotifications(this.prisma, this.notificationsService, async (tx, notify) => {
      const pendingCount = await tx.prescriptionRefillRequest.count({
        where: { prescriptionId, status: RefillRequestStatus.PENDING },
      });
      if (pendingCount > 0) {
        throw new DomainError(
          HttpStatus.CONFLICT,
          ErrorCode.REFILL_REQUEST_ALREADY_PENDING,
          'This prescription already has a pending refill request.',
        );
      }

      const created = await tx.prescriptionRefillRequest.create({
        data: {
          prescriptionId,
          requestedById: actor.id,
          patientNote: dto.patientNote?.trim() || null,
        },
      });

      await notify([
        refillRequestedNotificationDraft({
          appointmentId,
          doctorId: prescription.appointment.doctorId,
          requesterName,
        }),
      ]);

      return created;
    });

    await this.notificationsService.publish(notifications);
    return toRefillRequestResponseDto({ ...result, prescription });
  }

  async listForDoctor(
    doctorId: string,
    status: RefillRequestStatus | undefined,
    page: number,
    pageSize: number,
  ): Promise<RefillRequestListResponseDto> {
    const where: Prisma.PrescriptionRefillRequestWhereInput = {
      prescription: { appointment: { doctorId } },
      ...(status ? { status } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.prescriptionRefillRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: WITH_CONTEXT,
      }),
      this.prisma.prescriptionRefillRequest.count({ where }),
    ]);

    return { items: items.map(toRefillRequestResponseDto), total, page, pageSize };
  }

  async approve(doctorId: string, id: string, dto: DecideRefillDto): Promise<RefillRequestResponseDto> {
    return this.decide(doctorId, id, RefillRequestStatus.APPROVED, dto);
  }

  async deny(doctorId: string, id: string, dto: DecideRefillDto): Promise<RefillRequestResponseDto> {
    return this.decide(doctorId, id, RefillRequestStatus.DENIED, dto);
  }

  private async decide(
    doctorId: string,
    id: string,
    outcome: typeof RefillRequestStatus.APPROVED | typeof RefillRequestStatus.DENIED,
    dto: DecideRefillDto,
  ): Promise<RefillRequestResponseDto> {
    const refillRequest = await this.loadRefillRequestForDoctor(id, doctorId);
    if (refillRequest.status !== RefillRequestStatus.PENDING) {
      throw new DomainError(
        HttpStatus.CONFLICT,
        ErrorCode.REFILL_REQUEST_NOT_PENDING,
        'This refill request has already been decided.',
      );
    }

    const doctorNote = dto.doctorNote?.trim() || null;

    const { result, notifications } = await withNotifications(this.prisma, this.notificationsService, async (tx, notify) => {
      const decided = await tx.prescriptionRefillRequest.update({
        where: { id },
        data: { status: outcome, doctorNote, decidedById: doctorId, decidedAt: new Date() },
      });

      await notify([
        refillDecidedNotificationDraft({
          appointmentId: refillRequest.prescription.appointmentId,
          requestedById: refillRequest.requestedById,
          approved: outcome === RefillRequestStatus.APPROVED,
          doctorNote,
        }),
      ]);

      return decided;
    });

    await this.notificationsService.publish(notifications);
    return toRefillRequestResponseDto({ ...result, prescription: refillRequest.prescription });
  }

  private async loadPrescriptionWithAppointment(appointmentId: string, prescriptionId: string) {
    const prescription = await this.prisma.prescription.findUnique({
      where: { id: prescriptionId },
      include: { appointment: { include: { patient: true, dependent: true } } },
    });
    if (!prescription || prescription.appointmentId !== appointmentId) {
      throw new NotFoundException('Prescription not found');
    }
    return prescription;
  }

  private async loadRefillRequestForDoctor(id: string, doctorId: string): Promise<RefillRequestWithContext> {
    const refillRequest = await this.prisma.prescriptionRefillRequest.findUnique({
      where: { id },
      include: WITH_CONTEXT,
    });
    if (!refillRequest) {
      throw new NotFoundException('Refill request not found');
    }

    const { patientId, dependentId } = refillRequest.prescription.appointment;
    const treats = await hasTreatingRelationship(this.prisma, doctorId, patientId, dependentId ?? null);
    if (!treats) {
      throw new NotFoundException('Refill request not found');
    }

    return refillRequest;
  }
}

interface RefillRequestRow {
  id: string;
  status: RefillRequestStatus;
  patientNote: string | null;
  doctorNote: string | null;
  decidedAt: Date | null;
  createdAt: Date;
  prescription: {
    id: string;
    medication: string;
    appointmentId: string;
    appointment: {
      startsAt: Date;
      patientId: string;
      patient: { firstName: string; lastName: string; birthDate: Date | null };
      dependent: { id: string; firstName: string; lastName: string; relationship: DependentRelationship } | null;
    };
  };
}

function toRefillRequestResponseDto(row: RefillRequestRow): RefillRequestResponseDto {
  const { appointment } = row.prescription;
  return {
    id: row.id,
    appointmentId: row.prescription.appointmentId,
    prescriptionId: row.prescription.id,
    medication: row.prescription.medication,
    appointmentStartsAt: appointment.startsAt.toISOString(),
    patient: {
      id: appointment.patientId,
      displayName: `${appointment.patient.firstName} ${appointment.patient.lastName}`,
      age: appointment.patient.birthDate ? ageAt(appointment.patient.birthDate, new Date()) : null,
    },
    dependent: appointment.dependent
      ? {
          id: appointment.dependent.id,
          displayName: `${appointment.dependent.firstName} ${appointment.dependent.lastName}`,
          relationship: appointment.dependent.relationship,
        }
      : null,
    status: row.status,
    patientNote: row.patientNote,
    doctorNote: row.doctorNote,
    decidedAt: row.decidedAt ? row.decidedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}
