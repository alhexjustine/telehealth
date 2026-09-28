import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { BookAppointmentPage } from './book-appointment';
import { useCurrentUser } from '@/lib/auth/use-current-user';
import { usePublicDoctorProfile } from '@/lib/discovery/use-doctor-search';
import { useDoctorSlots } from '@/lib/availability/use-availability';
import { useSymptomCatalog } from '@/lib/matching/use-symptoms';
import { useBookAppointment } from '@/lib/appointments/use-appointments';
import { useAddDependent, useDependents } from '@/lib/dependents/use-dependents';
import { ApiError } from '@/lib/api-error';

vi.mock('@/lib/auth/use-current-user', () => ({ useCurrentUser: vi.fn() }));
vi.mock('@/lib/discovery/use-doctor-search', () => ({ usePublicDoctorProfile: vi.fn() }));
vi.mock('@/lib/availability/use-availability', () => ({ useDoctorSlots: vi.fn() }));
vi.mock('@/lib/matching/use-symptoms', () => ({ useSymptomCatalog: vi.fn() }));
vi.mock('@/lib/appointments/use-appointments', () => ({ useBookAppointment: vi.fn() }));
vi.mock('@/lib/dependents/use-dependents', () => ({ useDependents: vi.fn(), useAddDependent: vi.fn() }));

const DOCTOR_PROFILE = {
  id: 'doc-1',
  displayName: 'Dr. Grace Hopper',
  bio: null,
  specializations: [],
  yearsOfExperience: 10,
  consultationMinutes: 30,
  timezone: 'UTC',
};

const SYMPTOM_CATALOG = [
  {
    category: 'Head & Neurological',
    symptoms: [
      { id: 'sym-headache', slug: 'headache', name: 'Headache', category: 'Head & Neurological', isRedFlag: false },
      { id: 'sym-cough', slug: 'cough', name: 'Cough', category: 'Respiratory', isRedFlag: false },
    ],
  },
];

function renderBookingPage(path: string) {
  const queryClient = new QueryClient();
  const router = createMemoryRouter(
    [
      { path: '/patient/doctors/:doctorId/book', element: <BookAppointmentPage /> },
      { path: '/patient/appointments', element: <div>Appointments page</div> },
      { path: '/patient/profile', element: <div>Profile page</div> },
    ],
    { initialEntries: [path] },
  );
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

describe('BookAppointmentPage', () => {
  it('Book from the slot picker', async () => {
    vi.mocked(usePublicDoctorProfile).mockReturnValue({ data: DOCTOR_PROFILE, status: 'success', error: null, refetch: vi.fn(), isPending: false, isError: false } as never);
    vi.mocked(useSymptomCatalog).mockReturnValue({ data: SYMPTOM_CATALOG, isPending: false } as never);
    vi.mocked(useCurrentUser).mockReturnValue({ data: { profileComplete: true } } as never);
    vi.mocked(useDoctorSlots).mockReturnValue({ data: undefined, isPending: false } as never);
    const mutateAsync = vi.fn().mockResolvedValue({ id: 'apt-1', status: 'BOOKED' });
    vi.mocked(useBookAppointment).mockReturnValue({ mutateAsync, isPending: false } as never);
    vi.mocked(useDependents).mockReturnValue({ data: { items: [] } } as never);

    const router = renderBookingPage('/patient/doctors/doc-1/book?start=2026-10-05T09%3A00%3A00.000Z');

    const reasonInput = await screen.findByLabelText(/reason for visit/i);
    await userEvent.type(reasonInput, 'Recurring headaches for the past week');
    await userEvent.click(screen.getByRole('button', { name: /confirm booking/i }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        doctorId: 'doc-1',
        startsAt: '2026-10-05T09:00:00.000Z',
        reason: 'Recurring headaches for the past week',
      }),
    ));
    await waitFor(() => expect(router.state.location.pathname).toBe('/patient/appointments'));
  });

  it('No start param: shows a way back instead of a permanent loading state', async () => {
    vi.mocked(usePublicDoctorProfile).mockReturnValue({ data: DOCTOR_PROFILE, status: 'success', error: null, refetch: vi.fn(), isPending: false, isError: false } as never);
    vi.mocked(useSymptomCatalog).mockReturnValue({ data: SYMPTOM_CATALOG, isPending: false } as never);
    vi.mocked(useCurrentUser).mockReturnValue({ data: { profileComplete: true } } as never);
    vi.mocked(useDoctorSlots).mockReturnValue({ data: undefined, isPending: false } as never);
    vi.mocked(useBookAppointment).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);
    vi.mocked(useDependents).mockReturnValue({ data: { items: [] } } as never);

    renderBookingPage('/patient/doctors/doc-1/book');

    expect(await screen.findByText(/no time selected/i)).toBeInTheDocument();
    expect(screen.queryByText(/^loading…$/i)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to doctor profile/i })).toHaveAttribute(
      'href',
      '/patient/doctors/doc-1',
    );
  });

  it('Slot taken while confirming', async () => {
    vi.mocked(usePublicDoctorProfile).mockReturnValue({ data: DOCTOR_PROFILE, status: 'success', error: null, refetch: vi.fn(), isPending: false, isError: false } as never);
    vi.mocked(useSymptomCatalog).mockReturnValue({ data: SYMPTOM_CATALOG, isPending: false } as never);
    vi.mocked(useCurrentUser).mockReturnValue({ data: { profileComplete: true } } as never);
    vi.mocked(useDoctorSlots).mockReturnValue({
      data: [{ start: '2026-10-06T09:00:00.000Z', end: '2026-10-06T09:30:00.000Z' }],
      isPending: false,
    } as never);
    const mutateAsync = vi
      .fn()
      .mockRejectedValue(new ApiError('That slot is no longer available.', 409, 'SLOT_UNAVAILABLE'));
    vi.mocked(useBookAppointment).mockReturnValue({ mutateAsync, isPending: false } as never);
    vi.mocked(useDependents).mockReturnValue({ data: { items: [] } } as never);

    renderBookingPage('/patient/doctors/doc-1/book?start=2026-10-05T09%3A00%3A00.000Z');

    const reasonInput = await screen.findByLabelText(/reason for visit/i);
    await userEvent.type(reasonInput, 'Recurring headaches for the past week');
    await userEvent.click(screen.getByRole('button', { name: /confirm booking/i }));

    expect(await screen.findByText(/that time was just taken/i)).toBeInTheDocument();
  });

  it('Incomplete profile in the web app', async () => {
    vi.mocked(usePublicDoctorProfile).mockReturnValue({ data: DOCTOR_PROFILE, status: 'success', error: null, refetch: vi.fn(), isPending: false, isError: false } as never);
    vi.mocked(useSymptomCatalog).mockReturnValue({ data: SYMPTOM_CATALOG, isPending: false } as never);
    vi.mocked(useCurrentUser).mockReturnValue({ data: { profileComplete: false } } as never);
    vi.mocked(useDoctorSlots).mockReturnValue({ data: undefined, isPending: false } as never);
    const mutateAsync = vi.fn();
    vi.mocked(useBookAppointment).mockReturnValue({ mutateAsync, isPending: false } as never);
    vi.mocked(useDependents).mockReturnValue({ data: { items: [] } } as never);

    renderBookingPage('/patient/doctors/doc-1/book?start=2026-10-05T09%3A00%3A00.000Z');

    expect(await screen.findByText(/complete your profile first/i)).toBeInTheDocument();
    const profileLink = screen.getByRole('link', { name: /go to your profile/i });
    expect(profileLink).toHaveAttribute('href', '/patient/profile');
    expect(screen.getByRole('button', { name: /confirm booking/i })).toBeDisabled();
  });

  it('Choose a dependent when booking', async () => {
    vi.mocked(usePublicDoctorProfile).mockReturnValue({ data: DOCTOR_PROFILE, status: 'success', error: null, refetch: vi.fn(), isPending: false, isError: false } as never);
    vi.mocked(useSymptomCatalog).mockReturnValue({ data: SYMPTOM_CATALOG, isPending: false } as never);
    vi.mocked(useCurrentUser).mockReturnValue({ data: { profileComplete: true } } as never);
    vi.mocked(useDoctorSlots).mockReturnValue({ data: undefined, isPending: false } as never);
    const mutateAsync = vi.fn().mockResolvedValue({ id: 'apt-1', status: 'BOOKED' });
    vi.mocked(useBookAppointment).mockReturnValue({ mutateAsync, isPending: false } as never);
    vi.mocked(useDependents).mockReturnValue({
      data: {
        items: [
          { id: 'dep-1', firstName: 'Jamie', lastName: 'Lovelace', birthDate: '2018-06-15', relationship: 'CHILD', medicalConditions: null, allergies: null, currentMedications: null },
        ],
      },
    } as never);

    renderBookingPage('/patient/doctors/doc-1/book?start=2026-10-05T09%3A00%3A00.000Z');

    await userEvent.click(await screen.findByRole('button', { name: /jamie lovelace/i }));

    const reasonInput = screen.getByLabelText(/reason for visit/i);
    await userEvent.type(reasonInput, 'Fever and sore throat for two days');
    await userEvent.click(screen.getByRole('button', { name: /confirm booking/i }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ dependentId: 'dep-1' }),
    ));
  });

  it('Add a new dependent inline from the booking page', async () => {
    vi.mocked(usePublicDoctorProfile).mockReturnValue({ data: DOCTOR_PROFILE, status: 'success', error: null, refetch: vi.fn(), isPending: false, isError: false } as never);
    vi.mocked(useSymptomCatalog).mockReturnValue({ data: SYMPTOM_CATALOG, isPending: false } as never);
    vi.mocked(useCurrentUser).mockReturnValue({ data: { profileComplete: true } } as never);
    vi.mocked(useDoctorSlots).mockReturnValue({ data: undefined, isPending: false } as never);
    const mutateAsync = vi.fn().mockResolvedValue({ id: 'apt-1', status: 'BOOKED' });
    vi.mocked(useBookAppointment).mockReturnValue({ mutateAsync, isPending: false } as never);
    vi.mocked(useDependents).mockReturnValue({ data: { items: [] } } as never);
    const addDependentMutateAsync = vi.fn().mockResolvedValue({ id: 'dep-new' });
    vi.mocked(useAddDependent).mockReturnValue({ mutateAsync: addDependentMutateAsync, isPending: false } as never);

    renderBookingPage('/patient/doctors/doc-1/book?start=2026-10-05T09%3A00%3A00.000Z');

    await userEvent.click(await screen.findByRole('button', { name: /add someone new/i }));

    await userEvent.type(screen.getByLabelText(/^first name$/i), 'Jamie');
    await userEvent.type(screen.getByLabelText(/^last name$/i), 'Lovelace');
    await userEvent.click(screen.getByLabelText(/^birthdate$/i));
    await userEvent.click(await screen.findByRole('button', { name: /birthdate previous years/i }));
    await userEvent.click(await screen.findByRole('button', { name: '2018' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Jun' }));
    await userEvent.click(await screen.findByRole('button', { name: '15' }));
    await userEvent.click(screen.getByRole('button', { name: /^add dependent$/i }));

    await waitFor(() => expect(addDependentMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ firstName: 'Jamie', lastName: 'Lovelace', birthDate: '2018-06-15', relationship: 'CHILD' }),
    ));
    // The new dependent is auto-selected and the inline form closes.
    await waitFor(() => expect(screen.queryByLabelText(/^first name$/i)).not.toBeInTheDocument());

    const reasonInput = screen.getByLabelText(/reason for visit/i);
    await userEvent.type(reasonInput, 'Fever and sore throat for two days');
    await userEvent.click(screen.getByRole('button', { name: /confirm booking/i }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ dependentId: 'dep-new' }),
    ));
  });

  it('Book again preselects the same attendee', async () => {
    vi.mocked(usePublicDoctorProfile).mockReturnValue({ data: DOCTOR_PROFILE, status: 'success', error: null, refetch: vi.fn(), isPending: false, isError: false } as never);
    vi.mocked(useSymptomCatalog).mockReturnValue({ data: SYMPTOM_CATALOG, isPending: false } as never);
    vi.mocked(useCurrentUser).mockReturnValue({ data: { profileComplete: true } } as never);
    vi.mocked(useDoctorSlots).mockReturnValue({ data: undefined, isPending: false } as never);
    const mutateAsync = vi.fn().mockResolvedValue({ id: 'apt-1', status: 'BOOKED' });
    vi.mocked(useBookAppointment).mockReturnValue({ mutateAsync, isPending: false } as never);
    vi.mocked(useDependents).mockReturnValue({
      data: {
        items: [
          { id: 'dep-1', firstName: 'Jamie', lastName: 'Lovelace', birthDate: '2018-06-15', relationship: 'CHILD', medicalConditions: null, allergies: null, currentMedications: null },
        ],
      },
    } as never);

    renderBookingPage('/patient/doctors/doc-1/book?start=2026-10-05T09%3A00%3A00.000Z&dependent=dep-1');

    const dependentOption = await screen.findByRole('button', { name: /jamie lovelace/i });
    await waitFor(() => expect(dependentOption).toHaveAttribute('aria-pressed', 'true'));

    const reasonInput = screen.getByLabelText(/reason for visit/i);
    await userEvent.type(reasonInput, 'Follow-up for a recurring condition');
    await userEvent.click(screen.getByRole('button', { name: /confirm booking/i }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ dependentId: 'dep-1' }),
    ));
  });

  it('Book again for the account holder', async () => {
    vi.mocked(usePublicDoctorProfile).mockReturnValue({ data: DOCTOR_PROFILE, status: 'success', error: null, refetch: vi.fn(), isPending: false, isError: false } as never);
    vi.mocked(useSymptomCatalog).mockReturnValue({ data: SYMPTOM_CATALOG, isPending: false } as never);
    vi.mocked(useCurrentUser).mockReturnValue({ data: { profileComplete: true } } as never);
    vi.mocked(useDoctorSlots).mockReturnValue({ data: undefined, isPending: false } as never);
    const mutateAsync = vi.fn().mockResolvedValue({ id: 'apt-1', status: 'BOOKED' });
    vi.mocked(useBookAppointment).mockReturnValue({ mutateAsync, isPending: false } as never);
    vi.mocked(useDependents).mockReturnValue({
      data: {
        items: [
          { id: 'dep-1', firstName: 'Jamie', lastName: 'Lovelace', birthDate: '2018-06-15', relationship: 'CHILD', medicalConditions: null, allergies: null, currentMedications: null },
        ],
      },
    } as never);

    renderBookingPage('/patient/doctors/doc-1/book?start=2026-10-05T09%3A00%3A00.000Z');

    const myselfOption = await screen.findByRole('button', { name: /myself/i });
    await waitFor(() => expect(myselfOption).toHaveAttribute('aria-pressed', 'true'));

    const reasonInput = screen.getByLabelText(/reason for visit/i);
    await userEvent.type(reasonInput, 'Follow-up for a recurring condition');
    await userEvent.click(screen.getByRole('button', { name: /confirm booking/i }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ dependentId: undefined }),
    ));
  });
});
