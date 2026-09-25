import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ConfigModule } from './config/config.module.js';
import { LoggingModule } from './logging/logging.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { HealthModule } from './health/health.module.js';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter.js';
import { AuthModule } from './auth/auth.module.js';
import { SessionAuthGuard } from './auth/guards/session-auth.guard.js';
import { RolesGuard } from './auth/guards/roles.guard.js';
import { SpecializationsModule } from './specializations/specializations.module.js';
import { PatientsModule } from './patients/patients.module.js';
import { DoctorsModule } from './doctors/doctors.module.js';
import { AvailabilityModule } from './availability/availability.module.js';
import { DiscoveryModule } from './discovery/discovery.module.js';
import { MatchingModule } from './matching/matching.module.js';
import { AppointmentsModule } from './appointments/appointments.module.js';

@Module({
  imports: [
    ConfigModule,
    LoggingModule,
    PrismaModule,
    HealthModule,
    AuthModule,
    SpecializationsModule,
    PatientsModule,
    DoctorsModule,
    AvailabilityModule,
    DiscoveryModule,
    MatchingModule,
    AppointmentsModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    // Order matters: SessionAuthGuard (deny-by-default, attaches `request.user`)
    // must run before RolesGuard (reads `request.user.role`).
    {
      provide: APP_GUARD,
      useClass: SessionAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
