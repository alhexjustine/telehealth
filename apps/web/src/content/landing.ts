/**
 * All copy for the public landing page, as one typed, reviewable module (see
 * `design.md`'s "Content as typed modules" decision). Components import this
 * and render it; none of the section wording lives inline in JSX.
 *
 * The `trust.protections` list is a claim about what the application really
 * does — keep it in sync with the implementation (argon2id hashing, opaque
 * server-side sessions, role-based access control enforced in NestJS guards,
 * no admin access to clinical notes, the append-only admin audit log, and no
 * third-party services). `landing.test.ts` asserts all six stay present.
 */

export type LandingIcon =
  | 'search'
  | 'match'
  | 'calendar'
  | 'workspace'
  | 'records'
  | 'user-plus'
  | 'shield'
  | 'clipboard'
  | 'lock'
  | 'server'
  | 'users'
  | 'eye-off'
  | 'file-check'
  | 'building';

export interface CapabilityItem {
  icon: LandingIcon;
  title: string;
  description: string;
}

export interface StepItem {
  icon: LandingIcon;
  title: string;
  description: string;
}

export interface ProtectionItem {
  icon: LandingIcon;
  title: string;
  description: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export const landingContent = {
  hero: {
    eyebrow: 'Fictional prototype telehealth from Hey Doc',
    headline: 'Find the right doctor, book a visit, and get care — all in one place.',
    subcopy:
      'A calm, straightforward way to connect patients and doctors: search or get matched by symptoms, book a time that works, and meet in a focused consultation workspace with your notes and prescriptions kept in one record.',
    primaryCta: { label: 'Register as a patient', to: '/register/patient' },
    secondaryCta: { label: 'Join as a doctor', to: '/register/doctor' },
    // Decorative preview card beside the hero; the demo dataset's primary doctor, for consistency.
    previewCard: {
      initials: 'MS',
      name: 'Dr. Maria Santos',
      specialization: 'General Practice',
      bio: 'General practitioner focused on everyday health concerns and preventive care.',
      meta: '30 min consultation',
      tag: 'Book a time',
    },
  },

  capabilities: {
    heading: 'Everything you need for a visit',
    intro: 'From finding care to reviewing what happened afterward.',
    items: [
      {
        icon: 'search',
        title: 'Find a doctor',
        description:
          'Search the doctor directory by specialization and availability, and view verified profiles before you book.',
      },
      {
        icon: 'match',
        title: 'Guided symptom matching',
        description:
          'Not sure who to see? Describe your symptoms and get a ranked list of suitable, approved doctors.',
      },
      {
        icon: 'calendar',
        title: 'Booking and rescheduling',
        description:
          'Pick an open slot from a doctor’s real schedule, and reschedule or cancel yourself, any time.',
      },
      {
        icon: 'workspace',
        title: 'Consultation workspace',
        description:
          'A shared, focused space for patient and doctor to meet, tracked from scheduled through completed.',
      },
      {
        icon: 'records',
        title: 'Medical records',
        description:
          'Review your consultation notes and prescriptions afterward, scoped to you and your treating doctor.',
      },
    ] satisfies CapabilityItem[],
  },

  howItWorks: {
    heading: 'How it works',
    intro: 'From account to your visit summary, in five steps.',
    steps: [
      {
        icon: 'user-plus',
        title: 'Create an account',
        description: 'Register as a patient with your basic details — it takes a minute.',
      },
      {
        icon: 'search',
        title: 'Find the right doctor',
        description: 'Search by specialization, or answer a few questions for a guided match.',
      },
      {
        icon: 'calendar',
        title: 'Book a time',
        description: 'Choose an open slot from the doctor’s real availability.',
      },
      {
        icon: 'workspace',
        title: 'Meet in the consultation workspace',
        description: 'Join at your scheduled time in a shared, first-party workspace.',
      },
      {
        icon: 'records',
        title: 'Review your summary and prescriptions',
        description: 'Your doctor’s notes and any prescriptions are saved to your records.',
      },
    ] satisfies StepItem[],
  },

  forDoctors: {
    heading: 'For doctors',
    intro:
      'Bring your practice online with a profile that is reviewed before it goes live, a schedule you control, and notes that stay with the patient record.',
    points: [
      {
        icon: 'file-check',
        title: 'Profile verification',
        description:
          'Every doctor profile is reviewed by an administrator before it becomes visible to patients, and again after a credential change.',
      },
      {
        icon: 'calendar',
        title: 'Schedule management',
        description:
          'Set your working hours and time off; the system prevents overlapping or conflicting bookings automatically.',
      },
      {
        icon: 'clipboard',
        title: 'Consultation notes',
        description:
          'Record notes and prescriptions during a consultation; once completed, they are locked and kept with the patient’s record.',
      },
    ] satisfies CapabilityItem[],
  },

  specializations: {
    heading: 'Specializations offered',
    intro: 'The current catalog of specializations doctors on the platform practice in.',
    fallback: 'The specialization catalog is temporarily unavailable — please check back shortly.',
  },

  trust: {
    heading: 'Trust, privacy, and safety',
    intro:
      'Built as a standalone application, with no third-party services in the loop. Here is exactly what protects your data.',
    protections: [
      {
        icon: 'lock',
        title: 'Hashed passwords',
        description:
          'Passwords are never stored in plain text — they are hashed with argon2id, a modern, memory-hard hashing algorithm.',
      },
      {
        icon: 'server',
        title: 'Server-side sessions',
        description:
          'Signing in issues an opaque session token; the server checks it on every request, so signing out or being suspended takes effect immediately.',
      },
      {
        icon: 'shield',
        title: 'Role-based access control',
        description:
          'What each account can see and do — patient, doctor, or administrator — is enforced by the server on every request, not just hidden in the interface.',
      },
      {
        icon: 'eye-off',
        title: 'No admin access to clinical notes',
        description:
          'Administrators can manage accounts and appointments, but consultation notes, prescriptions, and booking reasons are never returned to them.',
      },
      {
        icon: 'file-check',
        title: 'Audit log of admin actions',
        description:
          'Every administrator action is written to an append-only audit log, so account and appointment changes are always traceable.',
      },
      {
        icon: 'users',
        title: 'No third-party services',
        description:
          'Authentication, matching, notifications, and records all run inside this application. No personal or health data is shared with any outside service.',
      },
    ] satisfies ProtectionItem[],
  },

  faq: {
    heading: 'Frequently asked questions',
    items: [
      {
        question: 'Is this a real medical service?',
        answer:
          'No. This is a fictional prototype built for demonstration. The doctors, records, and prescriptions are not real and must not be used for real medical decisions.',
      },
      {
        question: 'What should I do in a medical emergency?',
        answer:
          'This service is not for emergencies. Contact your local emergency services immediately.',
      },
      {
        question: 'How is my data protected?',
        answer:
          'Passwords are hashed with argon2id, sessions are validated on every request, and access to your data is limited by your role. See our privacy page for the full picture.',
      },
      {
        question: 'Can administrators read my consultation notes?',
        answer:
          'No. Administrators can manage accounts and appointments, but clinical content — consultation notes, prescriptions, and booking reasons — is never exposed to the admin role.',
      },
      {
        question: 'How do I find the right doctor?',
        answer:
          'Search the directory by specialization, or use guided symptom matching to get a ranked list of suitable, approved doctors.',
      },
      {
        question: 'Can I reschedule or cancel an appointment?',
        answer:
          'Yes. You can reschedule or cancel your own appointments at any time before they start, from your appointments list.',
      },
      {
        question: 'Is any of my data shared with third parties?',
        answer:
          'No. This application runs as a standalone stack with no external services — nothing you enter is sent anywhere outside it.',
      },
    ] satisfies FaqItem[],
  },
};
