import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator.js';
import { SpecializationsService } from './specializations.service.js';
import { SpecializationResponseDto } from './dto/specialization-response.dto.js';

@ApiTags('specializations')
@Controller('specializations')
export class SpecializationsController {
  constructor(private readonly specializationsService: SpecializationsService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Lists the medical specialization catalog, sorted by name' })
  @ApiOkResponse({ type: SpecializationResponseDto, isArray: true })
  async list(): Promise<SpecializationResponseDto[]> {
    const specializations = await this.specializationsService.list();
    return specializations.map((specialization) => ({
      id: specialization.id,
      slug: specialization.slug,
      name: specialization.name,
      description: specialization.description,
    }));
  }
}
