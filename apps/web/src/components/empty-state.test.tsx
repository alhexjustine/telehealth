import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { Inbox } from 'lucide-react';
import { EmptyState } from './empty-state';

describe('EmptyState', () => {
  it('Shows the icon, title, description, and an optional action link', () => {
    render(
      <MemoryRouter>
        <EmptyState
          icon={Inbox}
          title="Nothing here yet"
          description="Things will show up here."
          action={{ label: 'Go find some', to: '/somewhere' }}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText('Nothing here yet')).toBeInTheDocument();
    expect(screen.getByText('Things will show up here.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go find some' })).toHaveAttribute('href', '/somewhere');
  });

  it('Compact mode skips the card framing and title', () => {
    render(
      <MemoryRouter>
        <EmptyState icon={Inbox} title="Ignored in compact mode" description="Just this line." compact />
      </MemoryRouter>,
    );

    expect(screen.getByText('Just this line.')).toBeInTheDocument();
    expect(screen.queryByText('Ignored in compact mode')).not.toBeInTheDocument();
  });
});
