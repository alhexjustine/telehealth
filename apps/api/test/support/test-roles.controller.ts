import { Controller, Get } from '@nestjs/common';
import { Roles } from '../../src/auth/decorators/roles.decorator.js';
import { Role } from '../../src/generated/prisma/enums.js';

/**
 * Test-only routes for exercising `RolesGuard` against every role. This change
 * ships no admin-only endpoint of its own, so the guard e2e tests need a
 * fixture; it is registered only by `createTestApp()`, never by `main.ts`.
 */
@Controller('test/roles')
export class TestRolesController {
  @Get('patient-only')
  @Roles(Role.PATIENT)
  patientOnly(): { ok: true } {
    return { ok: true };
  }

  @Get('doctor-only')
  @Roles(Role.DOCTOR)
  doctorOnly(): { ok: true } {
    return { ok: true };
  }

  @Get('admin-only')
  @Roles(Role.ADMIN)
  adminOnly(): { ok: true } {
    return { ok: true };
  }

  @Get('any-signed-in')
  anySignedIn(): { ok: true } {
    return { ok: true };
  }
}
