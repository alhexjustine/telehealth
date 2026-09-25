import { Controller, Get } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SymptomsService } from './symptoms.service.js';
import { SymptomCategoryDto } from './dto/symptom-response.dto.js';

@ApiTags('doctor-matching')
@ApiCookieAuth('th_session')
@Controller('symptoms')
export class SymptomsController {
  constructor(private readonly symptomsService: SymptomsService) {}

  @Get()
  @ApiOperation({ summary: 'Lists the symptom catalog, grouped by category and sorted by name' })
  @ApiOkResponse({ type: SymptomCategoryDto, isArray: true })
  async list(): Promise<SymptomCategoryDto[]> {
    return this.symptomsService.listGroupedByCategory();
  }
}
