import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Dependent, Prisma } from '../generated/prisma/client.js';
import { DomainError } from '../common/errors/domain-error.js';
import { ErrorCode } from '../common/errors/error-codes.js';
import type { CreateDependentDto } from './dto/create-dependent.dto.js';
import type { UpdateDependentDto } from './dto/update-dependent.dto.js';
import type { DependentResponseDto } from './dto/dependent-response.dto.js';

export const MAX_DEPENDENTS_PER_PATIENT = 10;

@Injectable()
export class DependentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(patientId: string, dto: CreateDependentDto): Promise<DependentResponseDto> {
    const activeCount = await this.prisma.dependent.count({ where: { patientId, removedAt: null } });
    if (activeCount >= MAX_DEPENDENTS_PER_PATIENT) {
      throw new DomainError(
        HttpStatus.CONFLICT,
        ErrorCode.DEPENDENT_LIMIT_REACHED,
        `You can have at most ${MAX_DEPENDENTS_PER_PATIENT} dependents.`,
      );
    }

    const created = await this.prisma.dependent.create({
      data: {
        patientId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        birthDate: new Date(`${dto.birthDate}T00:00:00.000Z`),
        relationship: dto.relationship,
        medicalConditions: dto.medicalConditions,
        allergies: dto.allergies,
        currentMedications: dto.currentMedications,
      },
    });
    return this.toDto(created);
  }

  async list(patientId: string): Promise<DependentResponseDto[]> {
    const dependents = await this.prisma.dependent.findMany({
      where: { patientId, removedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    return dependents.map((dependent) => this.toDto(dependent));
  }

  async get(patientId: string, id: string): Promise<DependentResponseDto> {
    const dependent = await this.loadOwn(patientId, id);
    return this.toDto(dependent);
  }

  async update(patientId: string, id: string, dto: UpdateDependentDto): Promise<DependentResponseDto> {
    await this.loadOwn(patientId, id);

    const data: Prisma.DependentUpdateInput = {};
    if (dto.firstName !== undefined) data.firstName = dto.firstName;
    if (dto.lastName !== undefined) data.lastName = dto.lastName;
    if (dto.birthDate !== undefined) data.birthDate = new Date(`${dto.birthDate}T00:00:00.000Z`);
    if (dto.relationship !== undefined) data.relationship = dto.relationship;
    if (dto.medicalConditions !== undefined) data.medicalConditions = dto.medicalConditions;
    if (dto.allergies !== undefined) data.allergies = dto.allergies;
    if (dto.currentMedications !== undefined) data.currentMedications = dto.currentMedications;

    const updated = await this.prisma.dependent.update({ where: { id }, data });
    return this.toDto(updated);
  }

  async remove(patientId: string, id: string): Promise<DependentResponseDto> {
    await this.loadOwn(patientId, id);
    const removed = await this.prisma.dependent.update({ where: { id }, data: { removedAt: new Date() } });
    return this.toDto(removed);
  }

  /** Throws 404 unless `id` is one of `patientId`'s own, still-active dependents. */
  private async loadOwn(patientId: string, id: string): Promise<Dependent> {
    const dependent = await this.prisma.dependent.findUnique({ where: { id } });
    if (!dependent || dependent.patientId !== patientId || dependent.removedAt !== null) {
      throw new NotFoundException('Dependent not found');
    }
    return dependent;
  }

  private toDto(dependent: Dependent): DependentResponseDto {
    return {
      id: dependent.id,
      firstName: dependent.firstName,
      lastName: dependent.lastName,
      birthDate: dependent.birthDate.toISOString().slice(0, 10),
      relationship: dependent.relationship,
      medicalConditions: dependent.medicalConditions,
      allergies: dependent.allergies,
      currentMedications: dependent.currentMedications,
    };
  }
}
