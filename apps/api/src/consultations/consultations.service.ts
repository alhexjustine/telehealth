import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { AppointmentStatus, NotificationType, Role, SessionState } from '../generated/prisma/enums.js';
import { ageAt } from '../matching/age.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { withNotifications } from '../notifications/with-notifications.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';
import { appointmentRoom } from '../realtime/rooms.js';
import {
  AppointmentDependentSummaryDto,
  AppointmentDoctorSummaryDto,
  AppointmentPatientSummaryDto,
} from '../appointments/dto/appointment-response.dto.js';
import { ClinicalAccessPolicy, type ClinicalActor } from './clinical-access-policy.js';
import { SCHEDULED_SESSION_STATE, transition, type ConsultationAction } from './consultation-state.js';
import { toNoteDto, toPrescriptionDto, toSessionDto } from './consultation-mapper.js';
import { lockSession } from './session-lock.js';
import type { ConsultationSessionStateDto, ConsultationWorkspaceResponseDto } from './dto/consultation-response.dto.js';

const WITH_RELATIONS = {
  doctor: { include: { specializations: { include: { specialization: true } } } },
  patient: true,
  dependent: true,
  symptoms: { include: { symptom: true } },
} satisfies Prisma.AppointmentInclude;

type AppointmentWithRelations = Prisma.AppointmentGetPayload<{ include: typeof WITH_RELATIONS }>;

@Injectable()
export class ConsultationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  async getWorkspace(actor: ClinicalActor, appointmentId: string): Promise<ConsultationWorkspaceResponseDto> {
    const appointment = await this.loadAppointment(appointmentId);
    ClinicalAccessPolicy.assertCanViewWorkspace(actor, appointment);

    const sessionRow = await this.prisma.consultationSession.findUnique({ where: { appointmentId } });
    const session = sessionRow ?? SCHEDULED_SESSION_STATE;

    const isDoctor = actor.role === Role.DOCTOR;
    const patientCanSeeRecord = !isDoctor && session.state === SessionState.COMPLETED;
    const includeRecord = isDoctor || patientCanSeeRecord;

    const [note, prescriptions] = includeRecord
      ? await Promise.all([
          this.prisma.consultationNote.findUnique({ where: { appointmentId } }),
          this.prisma.prescription.findMany({ where: { appointmentId }, orderBy: { createdAt: 'asc' } }),
        ])
      : [null, []];

    return {
      appointmentId: appointment.id,
      startsAt: appointment.startsAt.toISOString(),
      endsAt: appointment.endsAt.toISOString(),
      reason: appointment.reason,
      status: appointment.status,
      doctor: doctorSummary(appointment),
      patient: patientSummary(appointment),
      dependent: dependentSummary(appointment),
      symptoms: appointment.symptoms.map((link) => ({ id: link.symptom.id, name: link.symptom.name })),
      session: toSessionDto(session),
      ...(isDoctor ? { patientMedicalSummary: patientMedicalSummary(appointment) } : {}),
      ...(includeRecord
        ? { note: note ? toNoteDto(note) : null, prescriptions: prescriptions.map(toPrescriptionDto) }
        : {}),
    };
  }

  async join(actor: ClinicalActor, appointmentId: string): Promise<ConsultationSessionStateDto> {
    return this.applyTransition(actor, appointmentId, 'join');
  }

  async start(actor: ClinicalActor, appointmentId: string): Promise<ConsultationSessionStateDto> {
    return this.applyTransition(actor, appointmentId, 'start');
  }

  async complete(actor: ClinicalActor, appointmentId: string): Promise<ConsultationSessionStateDto> {
    return this.applyTransition(actor, appointmentId, 'complete');
  }

  private async applyTransition(
    actor: ClinicalActor,
    appointmentId: string,
    action: ConsultationAction,
  ): Promise<ConsultationSessionStateDto> {
    const appointment = await this.loadAppointment(appointmentId);
    ClinicalAccessPolicy.assertCanViewWorkspace(actor, appointment);

    const now = new Date();
    const { result, notifications } = await withNotifications(
      this.prisma,
      this.notificationsService,
      async (tx, notify) => {
        const session = await lockSession(tx, appointmentId);

        let hasPatientSummary: boolean | undefined;
        if (action === 'complete') {
          const note = await tx.consultationNote.findUnique({ where: { appointmentId } });
          hasPatientSummary = Boolean(note?.patientSummary && note.patientSummary.trim().length > 0);
        }

        const next = transition({
          action,
          actorRole: actor.role,
          now,
          appointment: { startsAt: appointment.startsAt, endsAt: appointment.endsAt, status: appointment.status },
          session,
          hasPatientSummary,
        });

        await tx.consultationSession.update({
          where: { appointmentId },
          data: {
            state: next.state,
            patientJoinedAt: next.patientJoinedAt,
            doctorJoinedAt: next.doctorJoinedAt,
            startedAt: next.startedAt,
            completedAt: next.completedAt,
          },
        });

        if (action === 'complete') {
          await tx.appointment.update({
            where: { id: appointmentId },
            data: { status: AppointmentStatus.COMPLETED },
          });
          await notify([
            {
              userId: appointment.patientId,
              type: NotificationType.CONSULTATION_SUMMARY_AVAILABLE,
              title: 'Consultation summary available',
              body: `Dr. ${appointment.doctor.firstName} ${appointment.doctor.lastName} completed your consultation`,
              link: `/patient/records/${appointmentId}`,
              appointmentId,
            },
          ]);
        }

        return next;
      },
    );

    await this.notificationsService.publish(notifications);
    const dto = toSessionDto(result);
    this.realtimeGateway.emitToRoom(appointmentRoom(appointmentId), 'consultation:state', dto);
    return dto;
  }

  private async loadAppointment(appointmentId: string): Promise<AppointmentWithRelations> {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: WITH_RELATIONS,
    });
    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }
    return appointment;
  }
}

function doctorSummary(appointment: AppointmentWithRelations): AppointmentDoctorSummaryDto {
  return {
    id: appointment.doctorId,
    displayName: `${appointment.doctor.firstName} ${appointment.doctor.lastName}`,
    specializations: appointment.doctor.specializations.map((link) => ({
      id: link.specialization.id,
      name: link.specialization.name,
    })),
  };
}

/**
 * The identity shown for the visit: the dependent's, when the appointment is
 * for one, not the account holder's (`add-dependent-booking`'s "Workspace
 * access" requirement) — `id` stays the account's own, since that's the
 * actual signed-in identity every other check (join, message) keys off.
 */
function patientSummary(appointment: AppointmentWithRelations): AppointmentPatientSummaryDto {
  if (appointment.dependent) {
    return {
      id: appointment.patientId,
      displayName: `${appointment.dependent.firstName} ${appointment.dependent.lastName}`,
      age: ageAt(appointment.dependent.birthDate, new Date()),
    };
  }
  return {
    id: appointment.patientId,
    displayName: `${appointment.patient.firstName} ${appointment.patient.lastName}`,
    age: appointment.patient.birthDate ? ageAt(appointment.patient.birthDate, new Date()) : null,
  };
}

function dependentSummary(appointment: AppointmentWithRelations): AppointmentDependentSummaryDto | null {
  if (!appointment.dependent) return null;
  return {
    id: appointment.dependent.id,
    displayName: `${appointment.dependent.firstName} ${appointment.dependent.lastName}`,
    relationship: appointment.dependent.relationship,
  };
}

function patientMedicalSummary(appointment: AppointmentWithRelations) {
  if (appointment.dependent) {
    return {
      age: ageAt(appointment.dependent.birthDate, new Date()),
      medicalConditions: appointment.dependent.medicalConditions,
      allergies: appointment.dependent.allergies,
      currentMedications: appointment.dependent.currentMedications,
    };
  }
  return {
    age: appointment.patient.birthDate ? ageAt(appointment.patient.birthDate, new Date()) : null,
    medicalConditions: appointment.patient.medicalConditions,
    allergies: appointment.patient.allergies,
    currentMedications: appointment.patient.currentMedications,
  };
}
