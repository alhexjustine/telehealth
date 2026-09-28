import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiCookieAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import type { Env } from '../config/env.schema.js';
import { RateLimit } from '../common/rate-limit/rate-limit.decorator.js';
import { RateLimitGuard } from '../common/rate-limit/rate-limit.guard.js';
import { Public } from './decorators/public.decorator.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import type { AuthUser } from './current-user.js';
import { AuthService } from './auth.service.js';
import { RegisterPatientDto } from './dto/register-patient.dto.js';
import { RegisterDoctorDto } from './dto/register-doctor.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { AuthSessionResponseDto } from './dto/auth-session-response.dto.js';
import { CurrentUserResponseDto } from './dto/current-user-response.dto.js';
import { clearSessionCookie, setSessionCookie } from './session/session-cookie.js';
import type { SessionMeta } from './session/session.service.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService<Env, true>,
  ) {}

  @Post('register/patient')
  @Public()
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 5, windowMs: 60_000 })
  @ApiOperation({ summary: 'Registers a patient account and signs them in' })
  @ApiCreatedResponse({ type: AuthSessionResponseDto })
  async registerPatient(
    @Body() dto: RegisterPatientDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthSessionResponseDto> {
    const result = await this.authService.registerPatient(dto, this.sessionMeta(req));
    this.setCookie(res, result.token);
    return result.response;
  }

  @Post('register/doctor')
  @Public()
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 5, windowMs: 60_000 })
  @ApiOperation({ summary: 'Registers a doctor account (verification pending) and signs them in' })
  @ApiCreatedResponse({ type: AuthSessionResponseDto })
  async registerDoctor(
    @Body() dto: RegisterDoctorDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthSessionResponseDto> {
    const result = await this.authService.registerDoctor(dto, this.sessionMeta(req));
    this.setCookie(res, result.token);
    return result.response;
  }

  @Post('login')
  @Public()
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 10, windowMs: 60_000 })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Signs a user in' })
  @ApiOkResponse({ type: AuthSessionResponseDto })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthSessionResponseDto> {
    const result = await this.authService.login(dto, this.sessionMeta(req));
    this.setCookie(res, result.token);
    return result.response;
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiCookieAuth('th_session')
  @ApiOperation({ summary: 'Signs out of the current device' })
  async logout(@CurrentUser() user: AuthUser, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.authService.logout(user);
    clearSessionCookie(res, { secure: this.configService.get('COOKIE_SECURE', { infer: true }) });
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiCookieAuth('th_session')
  @ApiOperation({ summary: 'Signs out of every device' })
  async logoutAll(@CurrentUser() user: AuthUser, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.authService.logoutAll(user);
    clearSessionCookie(res, { secure: this.configService.get('COOKIE_SECURE', { infer: true }) });
  }

  @Post('password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiCookieAuth('th_session')
  @ApiOperation({ summary: 'Changes the signed-in user\'s password' })
  async changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto): Promise<void> {
    await this.authService.changePassword(user, dto);
  }

  @Get('me')
  @ApiCookieAuth('th_session')
  @ApiOperation({ summary: 'Returns the signed-in user' })
  @ApiOkResponse({ type: CurrentUserResponseDto })
  async me(@CurrentUser() user: AuthUser): Promise<CurrentUserResponseDto> {
    const result = await this.authService.me(user);
    return { ...result, joinWindowDisabled: this.configService.get('JOIN_WINDOW_DISABLED', { infer: true }) };
  }

  private sessionMeta(req: Request): SessionMeta {
    return { userAgent: req.headers['user-agent'], ip: req.ip };
  }

  private setCookie(res: Response, token: string): void {
    setSessionCookie(res, token, { secure: this.configService.get('COOKIE_SECURE', { infer: true }) });
  }
}
