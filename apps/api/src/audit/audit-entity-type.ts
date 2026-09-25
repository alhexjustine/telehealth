/**
 * Stable `entityType` strings stored on `AuditLog.entityType`, kept in one
 * place so every admin service agrees on the spelling (used for the audit
 * viewer's "affected record type and ID" filter).
 */
export const AuditEntityType = {
  USER: 'User',
  DOCTOR_PROFILE: 'DoctorProfile',
  APPOINTMENT: 'Appointment',
} as const;

export type AuditEntityType = (typeof AuditEntityType)[keyof typeof AuditEntityType];
