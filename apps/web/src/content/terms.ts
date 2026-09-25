import type { ContentSection } from './privacy';

/** Content for `/terms`. Structured so `TermsPage` just renders it. */

export const termsContent = {
  title: 'Terms of use',
  lastUpdated: '2026-09-25',
  intro:
    'These terms apply to this fictional-prototype telehealth application. By creating an account or using this site, you agree to them.',
  sections: [
    {
      heading: 'A fictional prototype',
      paragraphs: [
        'This application is a demonstration prototype, not a real medical service. The doctors, patient records, and prescriptions shown here are fictional and must not be used for real medical decisions, diagnosis, or treatment.',
        'This service is not for emergencies. If you are experiencing a medical emergency, contact your local emergency services immediately.',
      ],
    },
    {
      heading: 'Accounts',
      paragraphs: [
        'You are responsible for the accuracy of the information you provide when creating an account, and for keeping your password confidential. Administrator accounts are pre-provisioned by the operators of this prototype; there is no public administrator registration.',
      ],
    },
    {
      heading: 'Acceptable use',
      paragraphs: [
        'Use this application only for its intended demonstration purpose: exploring patient, doctor, and administrator workflows with fictional data. Do not enter real medical information, attempt to access another account, or attempt to disrupt the service.',
      ],
    },
    {
      heading: 'No warranty',
      paragraphs: [
        'This prototype is provided "as is", without warranty of any kind, and may change or be taken down at any time.',
      ],
    },
    {
      heading: 'Changes to these terms',
      paragraphs: [
        'These terms may be updated as the application changes. The date at the top of this page reflects the last update.',
      ],
    },
  ] satisfies ContentSection[],
};
