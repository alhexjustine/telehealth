import { Controller, Get, Res, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { HealthCheckService, HealthIndicatorService } from '@nestjs/terminus';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service.js';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly healthIndicatorService: HealthIndicatorService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Reports API and database health' })
  @ApiResponse({ status: 200, description: 'API and database are healthy' })
  @ApiResponse({ status: 503, description: 'The database is unreachable' })
  async check(@Res({ passthrough: false }) res: Response): Promise<void> {
    try {
      const result = await this.health.check([
        () =>
          this.healthIndicatorService.check('database').attempt(async () => {
            try {
              await this.prisma.$queryRaw`SELECT 1`;
            } catch {
              // Re-thrown with a fixed message: the driver error can otherwise
              // surface connection details in the public health response.
              throw new Error('database unreachable');
            }
          }),
      ]);
      res.status(200).json(result);
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        res.status(503).json(error.getResponse());
        return;
      }
      throw error;
    }
  }
}
