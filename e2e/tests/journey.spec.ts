import { expect, test } from '@playwright/test';
import {
  approveDoctorByName,
  bookFirstAvailableSlot,
  completePatientProfile,
  findDoctorAndOpenProfile,
  openConsultationAndAutoJoin,
  registerDoctor,
  registerPatient,
  rescheduleFirstAppointment,
  setWeekdayDoctorSchedule,
  signInAsAdmin,
  uniqueEmail,
  uniqueSuffix,
} from '../fixtures/accounts.js';
import { closeDbPool, moveAppointmentIntoJoinWindow } from '../fixtures/db.js';

test.afterAll(async () => {
  await closeDbPool();
});

/**
 * The `journey-verification` spec's core journey, end to end against the
 * real containerized stack: a doctor registers and sets a schedule, an
 * administrator approves them, a patient registers, completes their profile,
 * and finds the doctor, books and reschedules an appointment (with the
 * doctor's page open throughout to catch the live notification toasts),
 * both participants join the consultation, the doctor starts it, records a
 * note and a prescription, and completes it, the patient views the record,
 * and the administrator sees the audit trail.
 *
 * One browser context per role (design.md's "Browser test package"), so
 * their sessions never interfere. The only test-harness shortcut is moving
 * the *final*, post-reschedule appointment into the consultation join window
 * directly in the database (`moveAppointmentIntoJoinWindow`) — booking and
 * rescheduling both go through the real UI and API first.
 */
test('Journey passes', async ({ browser }) => {
  test.setTimeout(240_000);

  const doctorContext = await browser.newContext();
  const patientContext = await browser.newContext();
  const adminContext = await browser.newContext();
  const doctorPage = await doctorContext.newPage();
  const patientPage = await patientContext.newPage();
  const adminPage = await adminContext.newPage();

  try {
    const suffix = uniqueSuffix();
    const doctorLastName = `Journey${suffix}`;
    const doctorEmail = uniqueEmail(`doctor.${suffix}`);
    const patientLastName = `Patient${suffix}`;
    const patientEmail = uniqueEmail(`patient.${suffix}`);

    // 1. A visitor registers as a doctor and sets a schedule.
    await test.step('Doctor registers and sets a schedule', async () => {
      await registerDoctor(doctorPage, {
        firstName: 'Dana',
        lastName: doctorLastName,
        email: doctorEmail,
        licenseNumber: `LIC-${suffix}`,
      });
      await setWeekdayDoctorSchedule(doctorPage);
      // Stays on this page (still under `RoleAreaLayout`, so the realtime
      // socket connection is already live) to catch the notification toasts below.
    });

    // 2. The administrator approves that doctor.
    let doctorId = '';
    await test.step('Administrator approves the doctor', async () => {
      await signInAsAdmin(adminPage);
      doctorId = await approveDoctorByName(adminPage, doctorLastName);
    });

    // 3. A visitor registers as a patient, completes their profile, and uses
    // Find a doctor to reach the newly approved doctor.
    let doctorProfileId = '';
    await test.step('Patient registers, completes profile, and finds the doctor', async () => {
      await registerPatient(patientPage, {
        firstName: 'Pat',
        lastName: patientLastName,
        email: patientEmail,
      });
      await completePatientProfile(patientPage);
      doctorProfileId = await findDoctorAndOpenProfile(patientPage, doctorLastName);
      expect(doctorProfileId).toBe(doctorId);
    });

    // 4. The patient books, then reschedules; the doctor (page left open
    // since step 1) receives both notifications live, without a reload.
    let finalAppointmentId = '';
    await test.step('Patient books; Doctor sees a booking live', async () => {
      const bookingToast = expect(doctorPage.getByText('New booking', { exact: true })).toBeVisible({
        timeout: 15_000,
      });
      const booked = await bookFirstAvailableSlot(
        patientPage,
        'Journey test: recurring headaches for the past week, would like to be evaluated.',
      );
      await bookingToast;
      finalAppointmentId = booked.id;
    });

    await test.step('Patient reschedules; doctor sees the live reschedule notification', async () => {
      const rescheduleToast = expect(
        doctorPage.getByText('Appointment rescheduled', { exact: true }),
      ).toBeVisible({ timeout: 15_000 });
      const rescheduled = await rescheduleFirstAppointment(patientPage);
      await rescheduleToast;
      finalAppointmentId = rescheduled.id;
    });

    // The one documented test-harness shortcut: move the final, already-real
    // appointment's time into the consultation join window directly in the
    // database, instead of waiting for it in real time.
    await moveAppointmentIntoJoinWindow(finalAppointmentId);

    // 5. Both participants join; the doctor starts the consultation, writes
    // a clinical note and a prescription, and completes it.
    await test.step('Both participants join the consultation workspace', async () => {
      await openConsultationAndAutoJoin(patientPage, finalAppointmentId);
      await expect(patientPage.getByText('Waiting for the doctor to join…')).toBeVisible({ timeout: 15_000 });

      await openConsultationAndAutoJoin(doctorPage, finalAppointmentId);
      await expect(doctorPage.getByRole('button', { name: 'Start consultation' })).toBeEnabled({
        timeout: 15_000,
      });
    });

    await test.step('Doctor starts the consultation', async () => {
      const startResponse = doctorPage.waitForResponse(
        (response) => /\/api\/consultations\/.+\/start$/.test(response.url()) && response.request().method() === 'POST',
        { timeout: 15_000 },
      );
      await doctorPage.getByRole('button', { name: 'Start consultation' }).click();
      await startResponse;
      await expect(doctorPage.getByText('Consultation started')).toBeVisible();
    });

    await test.step('Doctor writes a clinical note', async () => {
      // Exact matches: the active tabpanel's own accessible name ("Findings & plan", from the
      // "Findings & plan" tab trigger via aria-labelledby) otherwise substring-matches both
      // "Findings" and "Plan" too, making those two locators ambiguous.
      await doctorPage.getByLabel('Findings', { exact: true }).fill('Mild tension, no red-flag symptoms observed.');
      await doctorPage.getByLabel('Assessment', { exact: true }).fill('Likely tension-type headache.');
      await doctorPage
        .getByLabel('Plan', { exact: true })
        .fill('Hydration, rest, follow up if symptoms persist beyond a week.');

      const notePutResponse = doctorPage.waitForResponse(
        (response) => /\/api\/consultations\/.+\/note$/.test(response.url()) && response.request().method() === 'PUT',
        { timeout: 15_000 },
      );
      await doctorPage
        .getByLabel('Patient summary')
        .fill('You have a tension headache. Rest, stay hydrated, and follow up if it does not improve.');
      await notePutResponse;
    });

    await test.step('Doctor writes a prescription', async () => {
      await doctorPage.getByRole('tab', { name: 'Prescriptions' }).click();
      await doctorPage.getByRole('button', { name: 'Add' }).click();
      const dialog = doctorPage.getByRole('dialog');
      await expect(dialog).toBeVisible({ timeout: 15_000 });
      await dialog.getByLabel('Medication').fill('Ibuprofen');
      await dialog.getByLabel('Dosage').fill('200mg');
      await dialog.getByLabel('Frequency').fill('Every 6 hours as needed');
      await dialog.getByLabel('Duration').fill('5 days');

      const prescriptionResponse = doctorPage.waitForResponse(
        (response) =>
          /\/api\/consultations\/.+\/prescriptions$/.test(response.url()) && response.request().method() === 'POST',
        { timeout: 15_000 },
      );
      await dialog.getByRole('button', { name: 'Save' }).click();
      await prescriptionResponse;
      await expect(doctorPage.getByText('Prescription added')).toBeVisible();
    });

    await test.step('Doctor completes the consultation', async () => {
      await doctorPage.getByRole('button', { name: 'Complete consultation' }).click();
      const confirmDialog = doctorPage.getByRole('dialog');
      await expect(confirmDialog).toBeVisible({ timeout: 15_000 });

      const completeResponse = doctorPage.waitForResponse(
        (response) => /\/api\/consultations\/.+\/complete$/.test(response.url()) && response.request().method() === 'POST',
        { timeout: 15_000 },
      );
      await confirmDialog.getByRole('button', { name: 'Complete', exact: true }).click();
      await completeResponse;
      await expect(doctorPage.getByText('Consultation completed')).toBeVisible();
    });

    // 6. The patient views the record afterward.
    await test.step('Patient views the record', async () => {
      await patientPage.goto('/patient/records');
      const recordLink = patientPage.getByRole('link').filter({ hasText: 'Dana' });
      await expect(recordLink).toBeVisible({ timeout: 15_000 });
      await recordLink.click();
      await patientPage.waitForURL(/\/patient\/records\/[0-9a-fA-F-]+$/, { timeout: 15_000 });
      await expect(
        patientPage.getByText('You have a tension headache. Rest, stay hydrated'),
      ).toBeVisible({ timeout: 15_000 });
      await expect(patientPage.getByText('Ibuprofen — 200mg')).toBeVisible();
    });

    // 7. The administrator sees the related audit entries.
    await test.step('Administrator sees the doctor-approval audit entry', async () => {
      await adminPage.goto(`/admin/audit?entityType=DoctorProfile&entityId=${doctorId}`);
      await expect(adminPage.getByText('DOCTOR_APPROVED')).toBeVisible({ timeout: 15_000 });
    });
  } finally {
    await doctorContext.close();
    await patientContext.close();
    await adminContext.close();
  }
});
