import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { AuditLogListQueryDto } from './dto/audit-log-list-query.dto.js';
import type { AuditLogEntryDto, AuditLogListResponseDto } from './dto/audit-log-response.dto.js';

const WITH_ACTOR = { actor: { select: { email: true } } } satisfies Prisma.AuditLogInclude;
type AuditLogWithActor = Prisma.AuditLogGetPayload<{ include: typeof WITH_ACTOR }>;

/**
 * The read-only viewer side of the audit log (`GET /admin/audit`,
 * `/admin/audit/{id}`), kept separate from `AuditService` (the
 * transactional writer every admin action calls) so the writer's contract —
 * "only callable with a `Prisma.TransactionClient`" — stays uncluttered by
 * read methods that intentionally use `PrismaService` directly.
 */
@Injectable()
export class AuditQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: AuditLogListQueryDto): Promise<AuditLogListResponseDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.AuditLogWhereInput = {
      ...(query.action ? { action: query.action } : {}),
      ...(query.actorId ? { actorId: query.actorId } : {}),
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.entityId ? { entityId: query.entityId } : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            createdAt: {
              ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
              ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: WITH_ACTOR,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { items: items.map(toDto), total, page, pageSize };
  }

  async detail(id: string): Promise<AuditLogEntryDto> {
    const entry = await this.prisma.auditLog.findUnique({ where: { id }, include: WITH_ACTOR });
    if (!entry) throw new NotFoundException('Audit entry not found');
    return toDto(entry);
  }
}

function toDto(entry: AuditLogWithActor): AuditLogEntryDto {
  return {
    id: entry.id,
    actorId: entry.actorId,
    actorEmail: entry.actor.email,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    reason: entry.reason,
    before: (entry.before as Record<string, unknown> | null) ?? null,
    after: (entry.after as Record<string, unknown> | null) ?? null,
    requestId: entry.requestId,
    ip: entry.ip,
    userAgent: entry.userAgent,
    createdAt: entry.createdAt.toISOString(),
  };
}
