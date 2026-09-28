import { expect, type Page } from '@playwright/test';

/** Matches `docker-compose.e2e.yml`'s fixed admin credentials for the browser suite. */
export const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'e2e-admin@telehealth.local';
export const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'E2E-Admin-Password-2026';

/** A password satisfying `passwordSchema` (>= 10 chars) and never equal to any generated email. */
export const TEST_PASSWORD = 'E2e-Journey-Pass-2026';

let counter = 0;

/** A short, unique, lowercase-alphanumeric token — safe inside an email local-part, a license number, or a name. */
export function uniqueSuffix(): string {
  counter += 1;
  return `${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** A fresh email per run, under a reserved test-only domain, so repeat runs never collide. */
export function uniqueEmail(prefix: string): string {
  return `${prefix}.${uniqueSuffix()}@e2e.telehealth.local`;
}

export async function signIn(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

export async function signInAsAdmin(page: Page): Promise<void> {
  await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  // An exact pathname match, not a glob suffix: `**/admin` would also match
  // `/register/admin`-shaped paths if any ever existed, and more subtly
  // resolves instantly against the *current* URL before a real navigation
  // happens if that URL already happens to end the same way.
  await page.waitForURL((url) => url.pathname === '/admin', { timeout: 15_000 });
}

export interface DoctorRegistration {
  firstName: string;
  lastName: string;
  email: string;
  password?: string;
  licenseNumber?: string;
}

/** Registers a doctor account and lands on `/doctor`. Selects the first specialization offered — which one doesn't matter for name-based search. */
export async function registerDoctor(page: Page, registration: DoctorRegistration): Promise<void> {
  await page.goto('/register/doctor');
  await page.getByLabel('First name').fill(registration.firstName);
  await page.getByLabel('Last name').fill(registration.lastName);
  await page.getByLabel('Email').fill(registration.email);
  await page.getByLabel('Password').fill(registration.password ?? TEST_PASSWORD);
  await page.getByLabel('License number').fill(registration.licenseNumber ?? `LIC-${uniqueSuffix()}`);
  const firstSpecialization = page.getByRole('checkbox').first();
  await expect(firstSpecialization).toBeVisible({ timeout: 15_000 });
  await firstSpecialization.click();
  await page.getByRole('button', { name: 'Create account' }).click();
  // An exact pathname match: `**/doctor` (a glob) also matches
  // `/register/doctor` — the page we're already on — which would resolve
  // this wait instantly, before the registration request even completes.
  await page.waitForURL((url) => url.pathname === '/doctor', { timeout: 15_000 });
}

export interface PatientRegistration {
  firstName: string;
  lastName: string;
  email: string;
  password?: string;
}

/** Registers a patient account and lands on `/patient`. */
export async function registerPatient(page: Page, registration: PatientRegistration): Promise<void> {
  await page.goto('/register/patient');
  await page.getByLabel('First name').fill(registration.firstName);
  await page.getByLabel('Last name').fill(registration.lastName);
  await page.getByLabel('Email').fill(registration.email);
  await page.getByLabel('Password').fill(registration.password ?? TEST_PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();
  // Same reasoning as `registerDoctor`: an exact pathname match, since
  // `**/patient` would also match `/register/patient`.
  await page.waitForURL((url) => url.pathname === '/patient', { timeout: 15_000 });
}

const MONTH_ABBREVIATIONS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/**
 * Drives `BirthDateSelect` (a popover year-grid → month-grid → day-grid picker,
 * not a fillable input) to a specific date, given a `label` matching its
 * `aria-label`. Assumes the field has no value yet, which is the only case
 * this fixture drives — an unset value opens the popover on the year step, a
 * set one opens on the day step showing its own month/year instead.
 */
async function selectBirthDate(page: Page, label: string, isoDate: string): Promise<void> {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) throw new Error(`selectBirthDate: expected an YYYY-MM-DD date, got "${isoDate}"`);
  const [, yearStr, monthStr, dayStr] = match;
  const year = Number(yearStr);
  const targetDecadeStart = Math.floor(year / 10) * 10;
  const monthAbbr = MONTH_ABBREVIATIONS[Number(monthStr) - 1];
  const day = Number(dayStr);

  await page.getByLabel(label, { exact: true }).click();
  const decadeHeading = page.getByText(/^\d{4} – \d{4}$/);
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const text = (await decadeHeading.textContent()) ?? '';
    const start = Number(text.split(' – ')[0]);
    if (start === targetDecadeStart) break;
    const pageButton = page.getByRole('button', {
      name: start > targetDecadeStart ? `${label} previous years` : `${label} next years`,
    });
    await pageButton.click();
  }
  await page.getByRole('button', { name: yearStr, exact: true }).click();
  await page.getByRole('button', { name: monthAbbr, exact: true }).click();
  await page.getByRole('button', { name: String(day), exact: true }).click();
}

export interface PatientProfileFields {
  birthDate?: string;
  weightKg?: string;
  heightCm?: string;
  phone?: string;
}

/** Fills in the fields `isPatientProfileComplete` requires (first/last name are already set at registration) and saves. */
export async function completePatientProfile(page: Page, fields: PatientProfileFields = {}): Promise<void> {
  await page.goto('/patient/profile');
  await expect(page.getByRole('heading', { name: 'Personal details' })).toBeVisible({ timeout: 15_000 });
  await selectBirthDate(page, 'Birthday', fields.birthDate ?? '1990-05-15');
  await page.getByLabel('Weight (kg)').fill(fields.weightKg ?? '70');
  await page.getByLabel('Height (cm)').fill(fields.heightCm ?? '175');
  await page.getByLabel('Phone number').fill(fields.phone ?? '+15555550123');
  const saveResponse = page.waitForResponse(
    (response) => /\/api\/patients\/me\/profile$/.test(response.url()) && response.request().method() === 'PATCH',
    { timeout: 15_000 },
  );
  await page.getByRole('button', { name: 'Save changes' }).click();
  await saveResponse;
  await expect(page.getByText('Profile saved')).toBeVisible();
}

/** Adds a Monday range, copies it to the rest of the working week, and saves — enough for slots to exist for the next 14 days. */
export async function setWeekdayDoctorSchedule(page: Page): Promise<void> {
  await page.goto('/doctor/schedule');
  await expect(page.getByRole('heading', { name: 'Time zone' })).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Add range' }).first().click();
  await page.getByRole('button', { name: 'Copy Monday to weekdays' }).click();
  const saveResponse = page.waitForResponse(
    (response) => /\/api\/doctors\/me\/availability$/.test(response.url()) && response.request().method() === 'PUT',
    { timeout: 15_000 },
  );
  await page.getByRole('button', { name: 'Save schedule' }).click();
  await saveResponse;
  await expect(page.getByText('Schedule saved')).toBeVisible();
}

/**
 * From the admin's "Doctor reviews" (pending tab), finds the doctor by last
 * name, opens their detail page, and approves them. Returns the doctor's id
 * (parsed from the detail page's URL) for later use (e.g. filtering the
 * audit log).
 */
export async function approveDoctorByName(adminPage: Page, lastName: string): Promise<string> {
  await adminPage.goto('/admin/doctors');
  await expect(adminPage.getByRole('heading', { name: 'Doctor reviews' })).toBeVisible({ timeout: 15_000 });
  const doctorLink = adminPage.getByRole('link').filter({ hasText: lastName }).first();
  await expect(doctorLink).toBeVisible({ timeout: 15_000 });
  await doctorLink.click();
  await adminPage.waitForURL(/\/admin\/doctors\/[0-9a-fA-F-]+$/, { timeout: 15_000 });
  const doctorId = new URL(adminPage.url()).pathname.split('/').pop();
  if (!doctorId) throw new Error('Could not parse the doctor id from the admin detail page URL');

  await adminPage.getByRole('button', { name: 'Approve', exact: true }).click();
  const approveResponse = adminPage.waitForResponse(
    (response) => /\/api\/admin\/doctors\/.+\/approve$/.test(response.url()) && response.request().method() === 'POST',
    { timeout: 15_000 },
  );
  await adminPage.getByRole('dialog').getByRole('button', { name: 'Approve', exact: true }).click();
  await approveResponse;
  await expect(adminPage.getByText('Doctor approved')).toBeVisible();
  return doctorId;
}

/** From `/patient/doctors`, searches by name and opens the matching doctor's public profile. Returns the doctor's id. */
export async function findDoctorAndOpenProfile(page: Page, lastName: string): Promise<string> {
  await page.goto('/patient/doctors');
  // Results update as the patient types (debounced); the visibility wait below covers the delay.
  await page.getByLabel('Search').fill(lastName);
  const doctorLink = page.getByRole('link').filter({ hasText: lastName }).first();
  await expect(doctorLink).toBeVisible({ timeout: 15_000 });
  await doctorLink.click();
  await page.waitForURL(/\/patient\/doctors\/[0-9a-fA-F-]+$/, { timeout: 15_000 });
  const doctorId = new URL(page.url()).pathname.split('/').pop();
  if (!doctorId) throw new Error('Could not parse the doctor id from the patient-facing profile URL');
  return doctorId;
}

/**
 * From an already-open doctor profile page, picks the earliest available
 * slot, follows through to the booking page, fills in a valid reason, and
 * confirms. Returns the id of the appointment the API created.
 */
export async function bookFirstAvailableSlot(page: Page, reason: string): Promise<{ id: string }> {
  await expect(page.getByRole('tablist', { name: 'Available days' })).toBeVisible({ timeout: 15_000 });
  const slotButton = page
    .getByRole('button')
    .filter({ hasText: /\d{1,2}:\d{2}/ })
    .first();
  await expect(slotButton).toBeVisible({ timeout: 15_000 });
  await slotButton.click();
  await page.getByRole('link', { name: 'Book' }).click();
  await page.waitForURL(/\/book\?start=/, { timeout: 15_000 });

  const reasonField = page.getByLabel('Reason for visit');
  await expect(reasonField).toBeVisible({ timeout: 15_000 });
  await reasonField.fill(reason);

  const bookResponse = page.waitForResponse(
    (response) => response.url().endsWith('/api/appointments') && response.request().method() === 'POST',
    { timeout: 15_000 },
  );
  await page.getByRole('button', { name: 'Confirm booking' }).click();
  const response = await bookResponse;
  const body = (await response.json()) as { id: string };
  await page.waitForURL((url) => url.pathname === '/patient/appointments', { timeout: 15_000 });
  return { id: body.id };
}

/**
 * From `/patient/appointments`, reschedules the (only) reschedulable
 * appointment to the earliest other available slot. Returns the id of the
 * new appointment the reschedule created (the old one is cancelled).
 */
export async function rescheduleFirstAppointment(page: Page): Promise<{ id: string }> {
  await page.goto('/patient/appointments');
  const rescheduleButton = page.getByRole('button', { name: 'Reschedule' });
  await expect(rescheduleButton).toBeEnabled({ timeout: 15_000 });
  await rescheduleButton.click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  const slotButton = dialog
    .getByRole('button')
    .filter({ hasText: /\d{1,2}:\d{2}/ })
    .first();
  await expect(slotButton).toBeVisible({ timeout: 15_000 });

  const rescheduleResponse = page.waitForResponse(
    (response) => /\/api\/appointments\/.+\/reschedule$/.test(response.url()) && response.request().method() === 'POST',
    { timeout: 15_000 },
  );
  await slotButton.click();
  const response = await rescheduleResponse;
  const body = (await response.json()) as { id: string };
  await expect(page.getByText('Appointment rescheduled')).toBeVisible();
  return { id: body.id };
}

/** Navigates to the consultation workspace and waits for this viewer's auto-join call to complete. */
export async function openConsultationAndAutoJoin(page: Page, appointmentId: string): Promise<void> {
  const joinResponse = page.waitForResponse(
    (response) =>
      new RegExp(`/api/consultations/${appointmentId}/join$`).test(response.url()) &&
      response.request().method() === 'POST',
    { timeout: 15_000 },
  );
  await page.goto(`/consultations/${appointmentId}`);
  await joinResponse;
}
