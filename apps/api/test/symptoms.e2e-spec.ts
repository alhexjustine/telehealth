import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './support/test-app.js';
import { registerPatient } from './support/auth-helpers.js';

describe('Symptom list', () => {
  let app: INestApplication;

  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('Patient lists symptoms', async () => {
    const patient = await registerPatient(app);
    const res = await patient.agent.get('/api/symptoms');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);

    const categoryNames = res.body.map((group: { category: string }) => group.category);
    expect(new Set(categoryNames).size).toBe(categoryNames.length); // one entry per category
    expect(categoryNames).toEqual([...categoryNames].sort());

    const allSymptoms = res.body.flatMap((group: { symptoms: unknown[] }) => group.symptoms);
    expect(allSymptoms.length).toBeGreaterThanOrEqual(40);
    for (const symptom of allSymptoms) {
      expect(symptom).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          slug: expect.any(String),
          name: expect.any(String),
          category: expect.any(String),
          isRedFlag: expect.any(Boolean),
        }),
      );
      expect(symptom).not.toHaveProperty('keywords');
      expect(symptom).not.toHaveProperty('weight');
      expect(symptom).not.toHaveProperty('links');
    }

    const headacheGroup = res.body.find((group: { category: string }) => group.category === 'Head & Neurological');
    const namesInGroup = headacheGroup.symptoms.map((s: { name: string }) => s.name);
    expect(namesInGroup).toEqual([...namesInGroup].sort());
  });

  it('Signed-out denied (symptoms)', async () => {
    const res = await request(app.getHttpServer()).get('/api/symptoms');
    expect(res.status).toBe(401);
  });
});
