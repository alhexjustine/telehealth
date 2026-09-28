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
import { DependentsModule } from './dependents/dependents.module.js';
import { DoctorsModule } from './doctors/doctors.module.js';
import { AvailabilityModule } from './availability/availability.module.js';
import { DiscoveryModule } from './discovery/discovery.module.js';
import { MatchingModule } from './matching/matching.module.js';
import { AppointmentsModule } from './appointments/appointments.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { RealtimeModule } from './realtime/realtime.module.js';
import { ConsultationsModule } from './consultations/consultations.module.js';
import { RecordsModule } from './records/records.module.js';
import { MessagesModule } from './messages/messages.module.js';
import { ReviewsModule } from './reviews/reviews.module.js';
import { RefillsModule } from './refills/refills.module.js';
import { FavoritesModule } from './favorites/favorites.module.js';
import { AuditModule } from './audit/audit.module.js';
import { AdminUsersModule } from './admin-users/admin-users.module.js';
import { AdminDoctorsModule } from './admin-doctors/admin-doctors.module.js';
import { AdminAppointmentsModule } from './admin-appointments/admin-appointments.module.js';
import { AdminDashboardModule } from './admin-dashboard/admin-dashboard.module.js';

@Module({
  imports: [
    ConfigModule,
    LoggingModule,
    PrismaModule,
    HealthModule,
    AuthModule,
    SpecializationsModule,
    PatientsModule,
    DependentsModule,
    DoctorsModule,
    AvailabilityModule,
    DiscoveryModule,
    MatchingModule,
    AppointmentsModule,
    RealtimeModule,
    NotificationsModule,
    ConsultationsModule,
    RecordsModule,
    MessagesModule,
    ReviewsModule,
    RefillsModule,
    FavoritesModule,
    AuditModule,
    AdminUsersModule,
    AdminDoctorsModule,
    AdminAppointmentsModule,
    AdminDashboardModule,
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
