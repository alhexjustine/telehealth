import { forwardRef, Module } from '@nestjs/common';
import { SpecializationsModule } from '../specializations/specializations.module.js';
import { RateLimitGuard } from '../common/rate-limit/rate-limit.guard.js';
import { RealtimeModule } from '../realtime/realtime.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { PasswordHasherService } from './password/password-hasher.service.js';
import { SessionService } from './session/session.service.js';
import { SessionAuthGuard } from './guards/session-auth.guard.js';
import { RolesGuard } from './guards/roles.guard.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

@Module({
  imports: [SpecializationsModule, forwardRef(() => RealtimeModule), AuditModule],
  controllers: [AuthController],
  providers: [
    PasswordHasherService,
    SessionService,
    SessionAuthGuard,
    RolesGuard,
    RateLimitGuard,
    AuthService,
  ],
  exports: [PasswordHasherService, SessionService, SessionAuthGuard, RolesGuard],
})
export class AuthModule {}
