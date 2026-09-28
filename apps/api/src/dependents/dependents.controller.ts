import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthUser } from '../auth/current-user.js';
import { Role } from '../generated/prisma/enums.js';
import { ErrorResponseDto } from '../common/dto/error-response.dto.js';
import { DependentsService } from './dependents.service.js';
import { CreateDependentDto } from './dto/create-dependent.dto.js';
import { UpdateDependentDto } from './dto/update-dependent.dto.js';
import { DependentListResponseDto, DependentResponseDto } from './dto/dependent-response.dto.js';

@ApiTags('dependents')
@ApiCookieAuth('th_session')
@Controller('patients/me/dependents')
@Roles(Role.PATIENT)
export class DependentsController {
  constructor(private readonly dependentsService: DependentsService) {}

  @Post()
  @ApiOperation({ summary: 'Adds a dependent to the signed-in patient\'s account' })
  @ApiCreatedResponse({ type: DependentResponseDto })
  @ApiResponse({ status: 409, description: 'DEPENDENT_LIMIT_REACHED', type: ErrorResponseDto })
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateDependentDto): Promise<DependentResponseDto> {
    return this.dependentsService.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: "Lists the signed-in patient's own active dependents" })
  @ApiOkResponse({ type: DependentListResponseDto })
  async list(@CurrentUser() user: AuthUser): Promise<DependentListResponseDto> {
    return { items: await this.dependentsService.list(user.id) };
  }

  @Get(':id')
  @ApiOperation({ summary: "Returns one of the signed-in patient's own dependents" })
  @ApiOkResponse({ type: DependentResponseDto })
  async get(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<DependentResponseDto> {
    return this.dependentsService.get(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: "Updates one of the signed-in patient's own dependents" })
  @ApiOkResponse({ type: DependentResponseDto })
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateDependentDto,
  ): Promise<DependentResponseDto> {
    return this.dependentsService.update(user.id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Removes one of the signed-in patient\'s own dependents (soft-remove; history is kept)' })
  @ApiOkResponse({ type: DependentResponseDto })
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<DependentResponseDto> {
    return this.dependentsService.remove(user.id, id);
  }
}
