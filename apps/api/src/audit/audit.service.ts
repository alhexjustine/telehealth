import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import type { AuditAction } from '../generated/prisma/enums.js';
import { getRequestContext } from '../common/middleware/request-context.js';
import type { AuditEntityType } from './audit-entity-type.js';

export interface AuditEntryInput {
  actorId: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId?: string | null;
  reason?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}

@Injectable()
export class AuditService {
  /**
   * Writes one audit entry. Takes a `Prisma.TransactionClient`, not
   * `PrismaService`, so it is a type error to call this outside a
   * transaction: the entry always commits or rolls back together with the
   * action it describes (see design.md's "Audit writer"). `requestId`,
   * `ip`, and `userAgent` are read from the request-scoped
   * `AsyncLocalStorage` context rather than taken as parameters, so a
   * caller can't forget to pass them (or fake them).
   */
  async record(tx: Prisma.TransactionClient, entry: AuditEntryInput): Promise<void> {
    const context = getRequestContext();
    await tx.auditLog.create({
      data: {
        actorId: entry.actorId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? undefined,
        reason: entry.reason ?? undefined,
        before: toJsonInput(entry.before),
        after: toJsonInput(entry.after),
        requestId: context?.requestId ?? '',
        ip: context?.ip,
        userAgent: context?.userAgent,
      },
    });
  }
}

function toJsonInput(value: Record<string, unknown> | null | undefined): Prisma.InputJsonValue | undefined {
  if (value === null || value === undefined) return undefined;
  return value as Prisma.InputJsonValue;
}
