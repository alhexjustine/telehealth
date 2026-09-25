import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import type { Env } from '../config/env.schema.js';
import { PrismaClient } from '../generated/prisma/client.js';

/**
 * Extends the generated client directly (Nest's own recommended pattern) so
 * every model delegate is available on `this`. No `$connect()` in
 * `onModuleInit`: the pg driver adapter opens connections lazily on first
 * query, which lets the app boot (and generate its OpenAPI document) even
 * when no database is reachable.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(configService: ConfigService<Env, true>) {
    const adapter = new PrismaPg(configService.get('DATABASE_URL', { infer: true }));
    super({ adapter });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
