import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { PasswordHasherService } from '../../src/auth/password/password-hasher.service.js';
import { Role } from '../../src/generated/prisma/enums.js';

let counter = 0;

export function uniqueEmail(prefix = 'user'): string {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}@example.com`;
}

export interface RegisteredUser {
  agent: ReturnType<typeof request.agent>;
  email: string;
  password: string;
  id: string;
}

export async function registerPatient(
  app: INestApplication,
  overrides: Partial<{ email: string; password: string; firstName: string; lastName: string }> = {},
): Promise<RegisteredUser> {
  const agent = request.agent(app.getHttpServer());
  const email = overrides.email ?? uniqueEmail('patient');
  const password = overrides.password ?? 'correct-horse-battery';
  const res = await agent
    .post('/api/auth/register/patient')
    .send({
      email,
      password,
      firstName: overrides.firstName ?? 'Ada',
      lastName: overrides.lastName ?? 'Lovelace',
    })
    .expect(201);
  return { agent, email, password, id: res.body.id as string };
}

export async function registerDoctor(
  app: INestApplication,
  overrides: Partial<{
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    licenseNumber: string;
    specializationIds: string[];
  }> = {},
): Promise<RegisteredUser> {
  const agent = request.agent(app.getHttpServer());
  const email = overrides.email ?? uniqueEmail('doctor');
  const password = overrides.password ?? 'correct-horse-battery';

  let specializationIds = overrides.specializationIds;
  if (!specializationIds) {
    const list = await agent.get('/api/specializations').expect(200);
    specializationIds = [list.body[0].id as string];
  }

  const res = await agent
    .post('/api/auth/register/doctor')
    .send({
      email,
      password,
      firstName: overrides.firstName ?? 'Grace',
      lastName: overrides.lastName ?? 'Hopper',
      specializationIds,
      licenseNumber: overrides.licenseNumber ?? `LIC-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    })
    .expect(201);
  return { agent, email, password, id: res.body.id as string };
}

/** Creates an ADMIN user directly (there is no public admin registration) and signs in. */
export async function createAndSignInAdmin(app: INestApplication): Promise<RegisteredUser> {
  const prisma = app.get(PrismaService);
  const hasher = app.get(PasswordHasherService);
  const email = uniqueEmail('admin');
  const password = 'correct-horse-battery';
  const passwordHash = await hasher.hash(password);
  const user = await prisma.user.create({ data: { email, passwordHash, role: Role.ADMIN } });

  const agent = request.agent(app.getHttpServer());
  await agent.post('/api/auth/login').send({ email, password }).expect(200);
  return { agent, email, password, id: user.id };
}
