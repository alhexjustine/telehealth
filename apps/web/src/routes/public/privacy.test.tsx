import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PrivacyPage } from './privacy';
import { privacyContent } from '@/content/privacy';

describe('PrivacyPage', () => {
  it('Privacy page content', () => {
    render(<PrivacyPage />);

    // Stored data, storage location, access by role, sessions, no third-party
    // sharing, and fictional data — one section (`h2`) per topic, in order.
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual([
      'What data we store',
      'Where your data lives',
      'Who can access your data',
      'How sessions work',
      'No third-party sharing',
      'All data is fictional',
    ]);
    expect(headings).toEqual(privacyContent.sections.map((section) => section.heading));

    // A last-updated date.
    expect(screen.getByText(/last updated/i)).toBeInTheDocument();
  });
});
