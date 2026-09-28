import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import {
  approveDoctorByName,
  bookFirstAvailableSlot,
  completePatientProfile,
  findDoctorAndOpenProfile,
  openConsultationAndAutoJoin,
  registerDoctor,
  registerPatient,
  setWeekdayDoctorSchedule,
  signInAsAdmin,
  uniqueEmail,
  uniqueSuffix,
} from '../fixtures/accounts.js';
import { closeDbPool, moveAppointmentIntoJoinWindow } from '../fixtures/db.js';

const SEVERE_IMPACTS = new Set(['serious', 'critical']);

async function expectNoSeriousViolations(page: Page, label: string): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze();
  const severe = results.violations.filter((violation) => SEVERE_IMPACTS.has(violation.impact ?? ''));
  const details = severe.map((violation) => `${violation.id} (${violation.impact}): ${violation.help}`).join('\n');
  expect(severe, `${label} has serious/critical accessibility violations:\n${details}`).toEqual([]);
}

/**
 * The `journey-verification` spec's "Cross-cutting browser checks": the
 * landing page, sign-in, the patient home page, Find care, the consultation
 * workspace, and the admin dashboard must have no serious or critical
 * automated accessibility violations (`@axe-core/playwright`).
 *
 * Self-contained (registers its own doctor/patient/admin sessions) rather
 * than depending on `journey.spec.ts`'s run order — test files should be
 * independent and runnable in any order or in isolation. Setup happens once
 * in `beforeAll` (serial mode) so the six checks below share the same
 * signed-in pages instead of repeating the full registration/approval/
 * booking flow six times.
 */
test.describe.configure({ mode: 'serial' });

test.describe('No serious or critical accessibility violations', () => {
  let browser: Browser;
  let publicContext: BrowserContext;
  let patientContext: BrowserContext;
  let doctorContext: BrowserContext;
  let adminContext: BrowserContext;
  let publicPage: Page;
  let patientPage: Page;
  let doctorPage: Page;
  let adminPage: Page;

  test.beforeAll(async ({ browser: injectedBrowser }) => {
    browser = injectedBrowser;
    publicContext = await browser.newContext();
    patientContext = await browser.newContext();
    doctorContext = await browser.newContext();
    adminContext = await browser.newContext();
    publicPage = await publicContext.newPage();
    patientPage = await patientContext.newPage();
    doctorPage = await doctorContext.newPage();
    adminPage = await adminContext.newPage();

    const suffix = uniqueSuffix();
    const doctorLastName = `A11y${suffix}`;
    const doctorEmail = uniqueEmail(`a11y-doctor.${suffix}`);
    const patientLastName = `A11yPatient${suffix}`;
    const patientEmail = uniqueEmail(`a11y-patient.${suffix}`);

    await registerDoctor(doctorPage, {
      firstName: 'Avery',
      lastName: doctorLastName,
      email: doctorEmail,
      licenseNumber: `LIC-${suffix}`,
    });
    await setWeekdayDoctorSchedule(doctorPage);

    await signInAsAdmin(adminPage);
    await approveDoctorByName(adminPage, doctorLastName);

    await registerPatient(patientPage, {
      firstName: 'Ada',
      lastName: patientLastName,
      email: patientEmail,
    });
    await completePatientProfile(patientPage);
    await findDoctorAndOpenProfile(patientPage, doctorLastName);
    const booked = await bookFirstAvailableSlot(
      patientPage,
      'Accessibility fixture: routine follow-up consultation to scan the workspace.',
    );

    await moveAppointmentIntoJoinWindow(booked.id);
    // Scan the doctor's view of the workspace — it has the richest set of
    // interactive controls (note editor, prescriptions table, action
    // buttons), so it's the more thorough accessibility surface to check.
    await openConsultationAndAutoJoin(doctorPage, booked.id);
    // The workspace's note/prescription/message editors live under tabs (their `bare` variant
    // suppresses each section's own heading since the tab trigger already labels it — see
    // apps/web/src/routes/consultation/workspace.tsx), so "Session timeline" is the stable
    // heading to wait on instead of a section-specific one.
    await expect(doctorPage.getByRole('heading', { name: 'Session timeline' })).toBeVisible({ timeout: 15_000 });

    await adminPage.goto('/admin');
    await expect(adminPage.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15_000 });
  });

  test.afterAll(async () => {
    await publicContext.close();
    await patientContext.close();
    await doctorContext.close();
    await adminContext.close();
    await closeDbPool();
  });

  test('Landing page', async () => {
    await publicPage.goto('/', { waitUntil: 'load' });
    await expectNoSeriousViolations(publicPage, 'The landing page');
  });

  test('Sign-in page', async () => {
    await publicPage.goto('/login', { waitUntil: 'load' });
    await expectNoSeriousViolations(publicPage, 'The sign-in page');
  });

  test('Patient home page', async () => {
    await patientPage.goto('/patient', { waitUntil: 'load' });
    await expect(patientPage.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15_000 });
    await expectNoSeriousViolations(patientPage, 'The patient home page');
  });

  test('Find care page', async () => {
    await patientPage.goto('/patient/find-care', { waitUntil: 'load' });
    await expect(patientPage.getByRole('heading', { name: 'Find care' })).toBeVisible({ timeout: 15_000 });
    await expectNoSeriousViolations(patientPage, 'The Find care page');
  });

  test('Consultation workspace', async () => {
    await expectNoSeriousViolations(doctorPage, 'The consultation workspace');
  });

  test('Admin dashboard', async () => {
    await expectNoSeriousViolations(adminPage, 'The admin dashboard');
  });
});
