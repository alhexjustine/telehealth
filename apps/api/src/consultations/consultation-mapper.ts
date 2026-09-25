import type { ConsultationNote, Prescription } from '../generated/prisma/client.js';
import type { ConsultationSessionState } from './consultation-state.js';
import type { ConsultationNoteDto, ConsultationSessionStateDto, PrescriptionResponseDto } from './dto/consultation-response.dto.js';

export function toSessionDto(session: ConsultationSessionState): ConsultationSessionStateDto {
  return {
    state: session.state,
    patientJoinedAt: session.patientJoinedAt ? session.patientJoinedAt.toISOString() : null,
    doctorJoinedAt: session.doctorJoinedAt ? session.doctorJoinedAt.toISOString() : null,
    startedAt: session.startedAt ? session.startedAt.toISOString() : null,
    completedAt: session.completedAt ? session.completedAt.toISOString() : null,
  };
}

export function toNoteDto(note: ConsultationNote): ConsultationNoteDto {
  return {
    findings: note.findings,
    assessment: note.assessment,
    plan: note.plan,
    patientSummary: note.patientSummary,
    updatedAt: note.updatedAt.toISOString(),
  };
}

export function toPrescriptionDto(prescription: Prescription): PrescriptionResponseDto {
  return {
    id: prescription.id,
    medication: prescription.medication,
    dosage: prescription.dosage,
    frequency: prescription.frequency,
    duration: prescription.duration,
    instructions: prescription.instructions,
    createdAt: prescription.createdAt.toISOString(),
    updatedAt: prescription.updatedAt.toISOString(),
  };
}
