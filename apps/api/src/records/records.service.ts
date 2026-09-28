import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { AppointmentStatus, RefillRequestStatus } from '../generated/prisma/enums.js';
import { ageAt } from '../matching/age.js';
import { DomainError } from '../common/errors/domain-error.js';
import { ErrorCode } from '../common/errors/error-codes.js';
import {
  ClinicalAccessPolicy,
  hasTreatingRelationship,
  type ClinicalActor,
} from '../consultations/clinical-access-policy.js';
import { lockSession } from '../consultations/session-lock.js';
import { toNoteDto, toPrescriptionDto } from '../consultations/consultation-mapper.js';
import type { ConsultationNoteDto, PrescriptionResponseDto } from '../consultations/dto/consultation-response.dto.js';
import type { CreatePrescriptionDto, UpdatePrescriptionDto } from './dto/prescription.dto.js';
import type { SaveConsultationNoteDto } from './dto/save-consultation-note.dto.js';
import type {
  DoctorPatientAppointmentDto,
  DoctorPatientRecordResponseDto,
  RecordDetailResponseDto,
  RecordListItemDto,
  RecordListResponseDto,
  RecordPrescriptionDto,
  RefillRequestDto,
} from './dto/record-response.dto.js';
import { MAX_PRESCRIPTIONS_PER_CONSULTATION } from './records.constants.js';

interface AppointmentParticipantsRow {
  patientId: string;
  doctorId: string;
  status: AppointmentStatus;
}

const WITH_DOCTOR_AND_NOTE = {
  doctor: { include: { specializations: { include: { specialization: true } } } },
  consultationNote: true,
} satisfies Prisma.AppointmentInclude;

type AppointmentWithDoctorAndNote = Prisma.AppointmentGetPayload<{ include: typeof WITH_DOCTOR_AND_NOTE }>;

@Injectable()
export class RecordsService {
  constructor(private readonly prisma: PrismaService) {}

  async saveNote(
    actor: ClinicalActor,
    appointmentId: string,
    dto: SaveConsultationNoteDto,
  ): Promise<ConsultationNoteDto> {
    const appointment = await this.loadAppointmentParticipants(appointmentId);
    const data = {
      findings: dto.findings ?? null,
      assessment: dto.assessment ?? null,
      plan: dto.plan ?? null,
      patientSummary: dto.patientSummary ?? null,
    };

    const note = await this.prisma.$transaction(async (tx) => {
      const session = await lockSession(tx, appointmentId);
      ClinicalAccessPolicy.assertCanWriteRecord(actor, appointment, session.state);
      return tx.consultationNote.upsert({
        where: { appointmentId },
        create: { appointmentId, ...data },
        update: data,
      });
    });

    return toNoteDto(note);
  }

  async addPrescription(
    actor: ClinicalActor,
    appointmentId: string,
    dto: CreatePrescriptionDto,
  ): Promise<PrescriptionResponseDto> {
    const appointment = await this.loadAppointmentParticipants(appointmentId);

    const created = await this.prisma.$transaction(async (tx) => {
      const session = await lockSession(tx, appointmentId);
      ClinicalAccessPolicy.assertCanWriteRecord(actor, appointment, session.state);

      const count = await tx.prescription.count({ where: { appointmentId } });
      if (count >= MAX_PRESCRIPTIONS_PER_CONSULTATION) {
        throw new DomainError(
          HttpStatus.CONFLICT,
          ErrorCode.PRESCRIPTION_LIMIT_REACHED,
          `A consultation can have at most ${MAX_PRESCRIPTIONS_PER_CONSULTATION} prescriptions.`,
        );
      }

      return tx.prescription.create({
        data: {
          appointmentId,
          medication: dto.medication,
          dosage: dto.dosage,
          frequency: dto.frequency,
          duration: dto.duration,
          instructions: dto.instructions ?? null,
        },
      });
    });

    return toPrescriptionDto(created);
  }

  async updatePrescription(
    actor: ClinicalActor,
    appointmentId: string,
    prescriptionId: string,
    dto: UpdatePrescriptionDto,
  ): Promise<PrescriptionResponseDto> {
    const appointment = await this.loadAppointmentParticipants(appointmentId);

    const updated = await this.prisma.$transaction(async (tx) => {
      const session = await lockSession(tx, appointmentId);
      ClinicalAccessPolicy.assertCanWriteRecord(actor, appointment, session.state);
      await assertPrescriptionBelongs(tx, appointmentId, prescriptionId);

      const data: Prisma.PrescriptionUpdateInput = {};
      if (dto.medication !== undefined) data.medication = dto.medication;
      if (dto.dosage !== undefined) data.dosage = dto.dosage;
      if (dto.frequency !== undefined) data.frequency = dto.frequency;
      if (dto.duration !== undefined) data.duration = dto.duration;
      if (dto.instructions !== undefined) data.instructions = dto.instructions;

      return tx.prescription.update({ where: { id: prescriptionId }, data });
    });

    return toPrescriptionDto(updated);
  }

  async deletePrescription(actor: ClinicalActor, appointmentId: string, prescriptionId: string): Promise<void> {
    const appointment = await this.loadAppointmentParticipants(appointmentId);

    await this.prisma.$transaction(async (tx) => {
      const session = await lockSession(tx, appointmentId);
      ClinicalAccessPolicy.assertCanWriteRecord(actor, appointment, session.state);
      await assertPrescriptionBelongs(tx, appointmentId, prescriptionId);
      await tx.prescription.delete({ where: { id: prescriptionId } });
    });
  }

  async listPatientRecords(patientId: string, page: number, pageSize: number): Promise<RecordListResponseDto> {
    const where: Prisma.AppointmentWhereInput = { patientId, status: AppointmentStatus.COMPLETED };
    const [items, total] = await Promise.all([
      this.prisma.appointment.findMany({
        where,
        orderBy: { startsAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: WITH_DOCTOR_AND_NOTE,
      }),
      this.prisma.appointment.count({ where }),
    ]);

    return { items: items.map(toRecordListItem), total, page, pageSize };
  }

  async getPatientRecord(actor: ClinicalActor, appointmentId: string): Promise<RecordDetailResponseDto> {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        ...WITH_DOCTOR_AND_NOTE,
        prescriptions: {
          orderBy: { createdAt: 'asc' },
          include: { refillRequests: { orderBy: { createdAt: 'desc' } } },
        },
      },
    });
    if (!appointment) {
      throw new NotFoundException('Record not found');
    }
    ClinicalAccessPolicy.assertCanPatientReadRecord(actor, appointment);

    return {
      appointmentId: appointment.id,
      startsAt: appointment.startsAt.toISOString(),
      doctor: {
        id: appointment.doctorId,
        displayName: `${appointment.doctor.firstName} ${appointment.doctor.lastName}`,
        specializations: appointment.doctor.specializations.map((link) => ({
          id: link.specialization.id,
          name: link.specialization.name,
        })),
      },
      note: appointment.consultationNote ? toNoteDto(appointment.consultationNote) : null,
      prescriptions: appointment.prescriptions.map(toRecordPrescriptionDto),
    };
  }

  async getDoctorPatientRecord(doctorId: string, patientId: string): Promise<DoctorPatientRecordResponseDto> {
    const treats = await hasTreatingRelationship(this.prisma, doctorId, patientId);
    if (!treats) {
      throw new NotFoundException('Patient record not found');
    }

    const patient = await this.prisma.patientProfile.findUnique({ where: { userId: patientId } });
    if (!patient) {
      throw new NotFoundException('Patient record not found');
    }

    const [appointmentsWithDoctor, completedConsultations] = await Promise.all([
      this.prisma.appointment.findMany({ where: { doctorId, patientId }, orderBy: { startsAt: 'desc' } }),
      this.prisma.appointment.findMany({
        where: { patientId, status: AppointmentStatus.COMPLETED },
        orderBy: { startsAt: 'desc' },
        include: WITH_DOCTOR_AND_NOTE,
      }),
    ]);

    return {
      patientId,
      firstName: patient.firstName,
      lastName: patient.lastName,
      age: patient.birthDate ? ageAt(patient.birthDate, new Date()) : null,
      medicalConditions: patient.medicalConditions,
      allergies: patient.allergies,
      currentMedications: patient.currentMedications,
      appointmentsWithDoctor: appointmentsWithDoctor.map(toDoctorPatientAppointment),
      completedConsultations: completedConsultations.map(toRecordListItem),
    };
  }

  private async loadAppointmentParticipants(appointmentId: string): Promise<AppointmentParticipantsRow> {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: { patientId: true, doctorId: true, status: true },
    });
    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }
    return appointment;
  }
}

async function assertPrescriptionBelongs(
  tx: Prisma.TransactionClient,
  appointmentId: string,
  prescriptionId: string,
): Promise<void> {
  const prescription = await tx.prescription.findUnique({ where: { id: prescriptionId } });
  if (!prescription || prescription.appointmentId !== appointmentId) {
    throw new NotFoundException('Prescription not found');
  }
}

function toRecordPrescriptionDto(prescription: {
  id: string;
  appointmentId: string;
  medication: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string | null;
  createdAt: Date;
  updatedAt: Date;
  refillRequests: {
    id: string;
    status: RefillRequestStatus;
    patientNote: string | null;
    doctorNote: string | null;
    decidedAt: Date | null;
    createdAt: Date;
  }[];
}): RecordPrescriptionDto {
  return {
    ...toPrescriptionDto(prescription),
    refillRequests: prescription.refillRequests.map(toRefillRequestDto),
  };
}

function toRefillRequestDto(refillRequest: {
  id: string;
  status: RefillRequestStatus;
  patientNote: string | null;
  doctorNote: string | null;
  decidedAt: Date | null;
  createdAt: Date;
}): RefillRequestDto {
  return {
    id: refillRequest.id,
    status: refillRequest.status,
    patientNote: refillRequest.patientNote,
    doctorNote: refillRequest.doctorNote,
    decidedAt: refillRequest.decidedAt ? refillRequest.decidedAt.toISOString() : null,
    createdAt: refillRequest.createdAt.toISOString(),
  };
}

function toRecordListItem(appointment: AppointmentWithDoctorAndNote): RecordListItemDto {
  return {
    appointmentId: appointment.id,
    startsAt: appointment.startsAt.toISOString(),
    doctor: {
      id: appointment.doctorId,
      displayName: `${appointment.doctor.firstName} ${appointment.doctor.lastName}`,
      specializations: appointment.doctor.specializations.map((link) => ({
        id: link.specialization.id,
        name: link.specialization.name,
      })),
    },
    patientSummary: appointment.consultationNote?.patientSummary ?? null,
  };
}

function toDoctorPatientAppointment(appointment: {
  id: string;
  startsAt: Date;
  endsAt: Date;
  status: AppointmentStatus;
  reason: string;
}): DoctorPatientAppointmentDto {
  return {
    id: appointment.id,
    startsAt: appointment.startsAt.toISOString(),
    endsAt: appointment.endsAt.toISOString(),
    status: appointment.status,
    reason: appointment.reason,
  };
}
