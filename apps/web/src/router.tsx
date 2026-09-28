import { createBrowserRouter, Outlet } from 'react-router';
import { RecoveryPage } from '@/components/recovery-page';
import { LandingPage } from '@/routes/public/landing';
import { TermsPage } from '@/routes/public/terms';
import { PrivacyPage } from '@/routes/public/privacy';
import { NotFoundPage } from '@/routes/public/not-found';
import { StatusPage } from '@/routes/status';
import { PublicLayout } from '@/routes/layouts/public-layout';
import { PublicOnlyLayout } from '@/routes/layouts/public-only-layout';
import { RequireRoleLayout } from '@/routes/layouts/require-role-layout';
import { RoleAreaLayout } from '@/routes/layouts/role-area-layout';
import { SignInPage } from '@/routes/auth/sign-in';
import { RegisterPatientPage } from '@/routes/auth/register-patient';
import { RegisterDoctorPage } from '@/routes/auth/register-doctor';
import { PatientHomePage } from '@/routes/patient/home';
import { PatientProfilePage } from '@/routes/patient/profile';
import { FindDoctorPage } from '@/routes/patient/doctors';
import { PatientDoctorProfilePage } from '@/routes/patient/doctor-profile';
import { FindCarePage } from '@/routes/patient/find-care';
import { BookAppointmentPage } from '@/routes/patient/book-appointment';
import { PatientAppointmentsPage } from '@/routes/patient/appointments';
import { PatientAppointmentDetailPage } from '@/routes/patient/appointment-detail';
import { DoctorHomePage } from '@/routes/doctor/home';
import { DoctorProfilePage } from '@/routes/doctor/profile';
import { DoctorSchedulePage } from '@/routes/doctor/schedule';
import { DoctorAppointmentsPage } from '@/routes/doctor/appointments';
import { DoctorAppointmentDetailPage } from '@/routes/doctor/appointment-detail';
import { DoctorPatientRecordPage } from '@/routes/doctor/patient-record';
import { AdminDashboardPage } from '@/routes/admin/dashboard';
import { AdminUsersPage } from '@/routes/admin/users';
import { AdminDoctorsPage } from '@/routes/admin/doctors';
import { AdminDoctorDetailPage } from '@/routes/admin/doctor-detail';
import { AdminAppointmentsPage } from '@/routes/admin/appointments';
import { AdminReviewsPage } from '@/routes/admin/reviews';
import { AdminAuditPage } from '@/routes/admin/audit';
import { NotificationsPage } from '@/routes/notifications-page';
import { ConsultationWorkspacePage } from '@/routes/consultation/workspace';
import { PatientRecordsPage } from '@/routes/patient/records';
import { PatientRecordDetailPage } from '@/routes/patient/record-detail';

// A single pathless root route so `RecoveryPage` (the `ui-resilience` spec's
// "Unexpected error recovery") catches a render error anywhere, even outside
// a role area (the product website, sign-in, `/status`). Each role area below
// additionally gets its own `errorElement`, so an error there is caught
// closer to its source without relying on bubbling past `RequireRoleLayout`.
export const router = createBrowserRouter([
  {
    element: <Outlet />,
    errorElement: <RecoveryPage />,
    children: [
      { path: '/status', element: <StatusPage /> },
      {
        element: <PublicLayout />,
        children: [
          { path: '/', element: <LandingPage /> },
          { path: '/terms', element: <TermsPage /> },
          { path: '/privacy', element: <PrivacyPage /> },
          {
            element: <PublicOnlyLayout />,
            children: [
              { path: '/login', element: <SignInPage /> },
              { path: '/register/patient', element: <RegisterPatientPage /> },
              { path: '/register/doctor', element: <RegisterDoctorPage /> },
            ],
          },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
      {
        path: '/patient',
        element: <RequireRoleLayout role="PATIENT" />,
        errorElement: <RecoveryPage />,
        children: [
          {
            element: (
              <RoleAreaLayout
                navItems={[
                  { to: '/patient', label: 'Home' },
                  { to: '/patient/doctors', label: 'Find a doctor' },
                  { to: '/patient/find-care', label: 'Find care' },
                  { to: '/patient/appointments', label: 'Appointments' },
                ]}
                profilePath="/patient/profile"
              />
            ),
            children: [
              { index: true, element: <PatientHomePage /> },
              { path: 'profile', element: <PatientProfilePage /> },
              { path: 'doctors', element: <FindDoctorPage /> },
              { path: 'doctors/:doctorId', element: <PatientDoctorProfilePage /> },
              { path: 'doctors/:doctorId/book', element: <BookAppointmentPage /> },
              { path: 'find-care', element: <FindCarePage /> },
              { path: 'appointments', element: <PatientAppointmentsPage /> },
              { path: 'appointments/:id', element: <PatientAppointmentDetailPage /> },
              { path: 'records', element: <PatientRecordsPage /> },
              { path: 'records/:appointmentId', element: <PatientRecordDetailPage /> },
              { path: 'notifications', element: <NotificationsPage /> },
              { path: '*', element: <NotFoundPage /> },
            ],
          },
        ],
      },
      {
        path: '/doctor',
        element: <RequireRoleLayout role="DOCTOR" />,
        errorElement: <RecoveryPage />,
        children: [
          {
            element: (
              <RoleAreaLayout
                navItems={[
                  { to: '/doctor', label: 'Home' },
                  { to: '/doctor/appointments', label: 'Appointments' },
                  { to: '/doctor/schedule', label: 'Schedule' },
                ]}
                profilePath="/doctor/profile"
              />
            ),
            children: [
              { index: true, element: <DoctorHomePage /> },
              { path: 'profile', element: <DoctorProfilePage /> },
              { path: 'schedule', element: <DoctorSchedulePage /> },
              { path: 'appointments', element: <DoctorAppointmentsPage /> },
              { path: 'appointments/:id', element: <DoctorAppointmentDetailPage /> },
              { path: 'patients/:patientId', element: <DoctorPatientRecordPage /> },
              { path: 'notifications', element: <NotificationsPage /> },
              { path: '*', element: <NotFoundPage /> },
            ],
          },
        ],
      },
      {
        path: '/consultations/:appointmentId',
        element: <RequireRoleLayout role={['PATIENT', 'DOCTOR']} />,
        errorElement: <RecoveryPage />,
        children: [{ index: true, element: <ConsultationWorkspacePage /> }],
      },
      {
        path: '/admin',
        element: <RequireRoleLayout role="ADMIN" />,
        errorElement: <RecoveryPage />,
        children: [
          {
            element: (
              <RoleAreaLayout
                navItems={[
                  { to: '/admin', label: 'Dashboard' },
                  { to: '/admin/users', label: 'Users' },
                  { to: '/admin/doctors', label: 'Doctor reviews' },
                  { to: '/admin/appointments', label: 'Appointments' },
                  { to: '/admin/reviews', label: 'Reviews' },
                  { to: '/admin/audit', label: 'Audit log' },
                ]}
              />
            ),
            children: [
              { index: true, element: <AdminDashboardPage /> },
              { path: 'users', element: <AdminUsersPage /> },
              { path: 'doctors', element: <AdminDoctorsPage /> },
              { path: 'doctors/:doctorId', element: <AdminDoctorDetailPage /> },
              { path: 'appointments', element: <AdminAppointmentsPage /> },
              { path: 'reviews', element: <AdminReviewsPage /> },
              { path: 'audit', element: <AdminAuditPage /> },
              { path: 'notifications', element: <NotificationsPage /> },
              { path: '*', element: <NotFoundPage /> },
            ],
          },
        ],
      },
    ],
  },
]);
