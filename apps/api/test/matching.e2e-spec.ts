import { afterEach, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { createTestApp } from './support/test-app.js';
import { resetDatabase } from './support/reset-db.js';
import { registerDoctor, registerPatient } from './support/auth-helpers.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { VerificationStatus } from '../src/generated/prisma/enums.js';

interface SymptomRow {
  id: string;
  slug: string;
  name: string;
  category: string;
  isRedFlag: boolean;
}

interface SpecializationRow {
  id: string;
  slug: string;
  name: string;
}

async function approveDoctor(app: INestApplication, doctorId: string): Promise<void> {
  const prisma = app.get(PrismaService);
  await prisma.doctorProfile.update({
    where: { userId: doctorId },
    data: { verificationStatus: VerificationStatus.APPROVED },
  });
}

describe('Guided matching', () => {
  let app: INestApplication;
  let symptoms: SymptomRow[];
  let specializations: SpecializationRow[];

  beforeAll(async () => {
    await resetDatabase();
    const bootstrapApp = await createTestApp();
    const prisma = bootstrapApp.get(PrismaService);
    const symptomRows = await prisma.symptom.findMany();
    symptoms = symptomRows.map((s) => ({
      id: s.id,
      slug: s.slug,
      name: s.name,
      category: s.category,
      isRedFlag: s.isRedFlag,
    }));
    const specializationRows = await prisma.specialization.findMany();
    specializations = specializationRows.map((s) => ({ id: s.id, slug: s.slug, name: s.name }));
    await bootstrapApp.close();
  });

  function symptomBySlug(slug: string): SymptomRow {
    const found = symptoms.find((s) => s.slug === slug);
    if (!found) throw new Error(`No symptom with slug ${slug}`);
    return found;
  }
  function specBySlug(slug: string): SpecializationRow {
    const found = specializations.find((s) => s.slug === slug);
    if (!found) throw new Error(`No specialization with slug ${slug}`);
    return found;
  }

  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('Neither symptoms nor description', async () => {
    const patient = await registerPatient(app);
    const res = await patient.agent.post('/api/matching').send({});
    expect(res.status).toBe(400);
  });

  it('Unknown symptom', async () => {
    const patient = await registerPatient(app);
    const res = await patient.agent
      .post('/api/matching')
      .send({ symptomIds: ['00000000-0000-4000-8000-000000000000'] });
    expect(res.status).toBe(400);
  });

  it('Non-patient denied', async () => {
    const doctor = await registerDoctor(app);
    const doctorRes = await doctor.agent.post('/api/matching').send({ descriptionText: 'cough' });
    expect(doctorRes.status).toBe(403);
  });

  it('Selected symptom', async () => {
    const derm = await registerDoctor(app, { specializationIds: [specBySlug('dermatology').id] });
    await approveDoctor(app, derm.id);

    const patient = await registerPatient(app);
    const res = await patient.agent
      .post('/api/matching')
      .send({ symptomIds: [symptomBySlug('skin-rash').id] });

    expect(res.status).toBe(200);
    expect(res.body.specializations[0]).toMatchObject({ specializationName: 'Dermatology' });
    expect(res.body.specializations[0].reasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ symptomName: 'Skin rash', specializationName: 'Dermatology' }),
      ]),
    );
    expect(res.body.doctors.map((d: { doctorId: string }) => d.doctorId)).toContain(derm.id);
  });

  it('Symptom found in the description', async () => {
    const patient = await registerPatient(app);
    const res = await patient.agent
      .post('/api/matching')
      .send({ descriptionText: "I've had a bad migraine since yesterday." });

    expect(res.status).toBe(200);
    expect(res.body.matchedSymptoms).toEqual([
      expect.objectContaining({ symptomName: 'Headache', source: 'described' }),
    ]);
    const names = res.body.specializations.map((s: { specializationName: string }) => s.specializationName);
    expect(names[0]).toBe('Neurology');
    expect(names[1]).toBe('General Practice');
  });

  it('Weights add up', async () => {
    const patient = await registerPatient(app);
    const res = await patient.agent
      .post('/api/matching')
      .send({ symptomIds: [symptomBySlug('headache').id, symptomBySlug('cough').id] });

    expect(res.status).toBe(200);
    const scores = new Map(
      res.body.specializations.map((s: { specializationName: string; score: number }) => [
        s.specializationName,
        s.score,
      ]),
    );
    expect(scores.get('General Practice')).toBe(3);
    expect(scores.get('Neurology')).toBe(3);
    expect(scores.get('Pulmonology')).toBe(2);
    expect(res.body.specializations.map((s: { specializationName: string }) => s.specializationName)).toEqual([
      'General Practice',
      'Neurology',
      'Pulmonology',
    ]);
  });

  it('Under-18 patient', async () => {
    const patient = await registerPatient(app);
    const twelveYearsAgo = new Date();
    twelveYearsAgo.setUTCFullYear(twelveYearsAgo.getUTCFullYear() - 12);
    const birthDate = twelveYearsAgo.toISOString().slice(0, 10);
    await patient.agent.patch('/api/patients/me/profile').send({ birthDate }).expect(200);

    const res = await patient.agent
      .post('/api/matching')
      .send({ symptomIds: [symptomBySlug('cough').id] });

    expect(res.status).toBe(200);
    expect(res.body.specializations[0]).toMatchObject({ specializationName: 'Pediatrics' });
    expect(res.body.specializations[0].reasons).toEqual(
      expect.arrayContaining([expect.objectContaining({ source: 'age', specializationName: 'Pediatrics' })]),
    );
    expect(res.body.ageUnknown).toBe(false);
  });

  it('No match', async () => {
    const gp = await registerDoctor(app, { specializationIds: [specBySlug('general-practice').id] });
    await approveDoctor(app, gp.id);

    const patient = await registerPatient(app);
    const res = await patient.agent
      .post('/api/matching')
      .send({ descriptionText: "I just don't feel right" });

    expect(res.status).toBe(200);
    expect(res.body.matchedSymptoms).toEqual([]);
    expect(res.body.specializations).toEqual([
      expect.objectContaining({ specializationName: 'General Practice', score: 1 }),
    ]);
    expect(res.body.doctors.map((d: { doctorId: string }) => d.doctorId)).toContain(gp.id);
  });

  it('Deterministic result', async () => {
    const patient = await registerPatient(app);
    const body = { symptomIds: [symptomBySlug('headache').id, symptomBySlug('cough').id] };

    const first = await patient.agent.post('/api/matching').send(body);
    const second = await patient.agent.post('/api/matching').send(body);

    expect(first.status).toBe(200);
    expect(second.body.specializations).toEqual(first.body.specializations);
    expect(second.body.doctors).toEqual(first.body.doctors);
  });

  it('Red flag selected', async () => {
    const patient = await registerPatient(app);
    const res = await patient.agent
      .post('/api/matching')
      .send({ symptomIds: [symptomBySlug('chest-pain').id] });

    expect(res.status).toBe(200);
    expect(res.body.urgent).toBe(true);
    expect(res.body.emergencyMessage).toContain('Chest pain');
    expect(res.body.specializations.map((s: { specializationName: string }) => s.specializationName)).toContain(
      'Cardiology',
    );
  });

  it('Red flag described', async () => {
    const patient = await registerPatient(app);
    const res = await patient.agent
      .post('/api/matching')
      .send({ descriptionText: 'I am having difficulty breathing right now' });

    expect(res.status).toBe(200);
    expect(res.body.urgent).toBe(true);
  });
});
