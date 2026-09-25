/** Content for `/privacy`. Structured so `PrivacyPage` just renders it. */

export interface ContentSection {
  heading: string;
  paragraphs: string[];
}

export const privacyContent = {
  title: 'Privacy policy',
  lastUpdated: '2026-09-25',
  intro:
    'This page explains what data this fictional-prototype telehealth application stores, where it lives, who can access it, and how sessions work. It is written to match how the application is actually built.',
  sections: [
    {
      heading: 'What data we store',
      paragraphs: [
        'Account data: your name, email address, and a securely hashed password — never your password itself.',
        'For patients: profile details you provide, such as date of birth, weight, height, contact information, and medical history entered for booking or consultations.',
        'For doctors: your profile, specializations, license number, biography, years of experience, and availability schedule.',
        'Health data: appointment bookings, the reason for a visit, consultation notes, and prescriptions recorded by your treating doctor.',
        'Operational data: notifications, and, for administrators, an audit log of administrative actions.',
      ],
    },
    {
      heading: 'Where your data lives',
      paragraphs: [
        'All data stays in this application’s own PostgreSQL database, running inside the same Docker Compose stack as the rest of the application. It is not sent to, processed by, or backed up on any external platform.',
      ],
    },
    {
      heading: 'Who can access your data',
      paragraphs: [
        'Patients can see their own profile, appointments, and their own consultation records.',
        'Doctors can see the profiles and records of patients they are treating — appointments booked with them — and nothing else.',
        'Administrators can manage accounts, review doctor profiles, and oversee appointments, but cannot read consultation notes, prescriptions, or booking reasons. Every administrator action is written to an append-only audit log.',
        'All of this is enforced by the server on every request, not only hidden in the interface.',
      ],
    },
    {
      heading: 'How sessions work',
      paragraphs: [
        'Signing in issues a random, opaque session token stored in an HttpOnly cookie your browser cannot read from script. The server validates this token, against a hashed copy in its own database, on every request — so signing out, or an administrator suspending an account, takes effect immediately rather than waiting for the token to expire.',
      ],
    },
    {
      heading: 'No third-party sharing',
      paragraphs: [
        'This application does not use any external authentication provider, analytics platform, email or SMS service, file storage service, or AI service. Nothing you enter is transmitted to a third party.',
      ],
    },
    {
      heading: 'All data is fictional',
      paragraphs: [
        'This is a demonstration prototype. Every account, doctor, appointment, and medical record in this system is fictional test data, not real medical information.',
      ],
    },
  ] satisfies ContentSection[],
};
