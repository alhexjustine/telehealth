import { createBrowserRouter } from 'react-router';
import { RootPage } from '@/routes/root';
import { StatusPage } from '@/routes/status';
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
import { AdminHomePage } from '@/routes/admin/home';
import { NotificationsPage } from '@/routes/notifications-page';
import { ConsultationWorkspacePage } from '@/routes/consultation/workspace';
import { PatientRecordsPage } from '@/routes/patient/records';
import { PatientRecordDetailPage } from '@/routes/patient/record-detail';

export const router = createBrowserRouter([
  { path: '/', element: <RootPage /> },
  { path: '/status', element: <StatusPage /> },
  {
    element: <PublicOnlyLayout />,
    children: [
      { path: '/login', element: <SignInPage /> },
      { path: '/register/patient', element: <RegisterPatientPage /> },
      { path: '/register/doctor', element: <RegisterDoctorPage /> },
    ],
  },
  {
    path: '/patient',
    element: <RequireRoleLayout role="PATIENT" />,
    children: [
      {
        element: (
          <RoleAreaLayout
            navItems={[
              { to: '/patient', label: 'Home' },
              { to: '/patient/doctors', label: 'Find a doctor' },
              { to: '/patient/find-care', label: 'Find care' },
              { to: '/patient/appointments', label: 'Appointments' },
              { to: '/patient/profile', label: 'Profile' },
            ]}
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
        ],
      },
    ],
  },
  {
    path: '/doctor',
    element: <RequireRoleLayout role="DOCTOR" />,
    children: [
      {
        element: (
          <RoleAreaLayout
            navItems={[
              { to: '/doctor', label: 'Home' },
              { to: '/doctor/appointments', label: 'Appointments' },
              { to: '/doctor/profile', label: 'Profile' },
              { to: '/doctor/schedule', label: 'Schedule' },
            ]}
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
        ],
      },
    ],
  },
  {
    path: '/consultations/:appointmentId',
    element: <RequireRoleLayout role={['PATIENT', 'DOCTOR']} />,
    children: [{ index: true, element: <ConsultationWorkspacePage /> }],
  },
  {
    path: '/admin',
    element: <RequireRoleLayout role="ADMIN" />,
    children: [
      {
        element: <RoleAreaLayout navItems={[{ to: '/admin', label: 'Home' }]} />,
        children: [
          { index: true, element: <AdminHomePage /> },
          { path: 'notifications', element: <NotificationsPage /> },
        ],
      },
    ],
  },
]);
