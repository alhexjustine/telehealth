import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DoctorProfileFormFields } from '@/components/doctor-profile-form-fields';
import { AdminAuditLink } from '@/components/admin/audit-link';
import { InitialsAvatar } from '@/components/initials-avatar';
import { useSpecializations } from '@/lib/use-specializations';
import {
  doctorProfileSchema,
  type DoctorProfileFormInput,
  type DoctorProfileFormValues,
} from '@/lib/doctors/doctor-profile-schema';
import {
  useAdminDoctor,
  useApproveDoctor,
  useRejectDoctor,
  useUpdateAdminDoctorProfile,
} from '@/lib/admin/use-admin-doctors';
import { QueryState } from '@/components/query-state';

const REJECT_NOTE_MIN_LENGTH = 5;

function verificationVariant(status: string): 'default' | 'secondary' | 'destructive' {
  if (status === 'APPROVED') return 'default';
  if (status === 'PENDING') return 'secondary';
  return 'destructive';
}

export function AdminDoctorDetailPage() {
  const { doctorId } = useParams<{ doctorId: string }>();
  const doctor = useAdminDoctor(doctorId);
  const specializations = useSpecializations();
  const updateProfile = useUpdateAdminDoctorProfile();
  const approve = useApproveDoctor();
  const reject = useRejectDoctor();

  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [approveNote, setApproveNote] = useState('');
  const [rejectNote, setRejectNote] = useState('');

  const form = useForm<DoctorProfileFormInput, unknown, DoctorProfileFormValues>({
    resolver: zodResolver(doctorProfileSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      bio: '',
      licenseNumber: '',
      consultationMinutes: 30,
      specializationIds: [],
    },
  });

  useEffect(() => {
    if (doctor.data) {
      form.reset({
        firstName: doctor.data.firstName,
        lastName: doctor.data.lastName,
        bio: doctor.data.bio ?? '',
        yearsOfExperience: doctor.data.yearsOfExperience ?? undefined,
        licenseNumber: doctor.data.licenseNumber,
        consultationMinutes: doctor.data.consultationMinutes,
        specializationIds: doctor.data.specializations.map((s) => s.id),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when fresh server data arrives
  }, [doctor.data]);

  if (!doctorId) return null;

  async function onSubmit(values: DoctorProfileFormValues) {
    try {
      await updateProfile.mutateAsync({
        id: doctorId!,
        body: { ...values, consultationMinutes: values.consultationMinutes as 15 | 20 | 30 | 45 | 60 },
      });
      toast.success('Profile saved');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save the profile');
    }
  }

  async function confirmApprove() {
    try {
      await approve.mutateAsync({ id: doctorId!, body: approveNote.trim() ? { note: approveNote.trim() } : {} });
      toast.success('Doctor approved');
      setApproveOpen(false);
      setApproveNote('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not approve the doctor');
    }
  }

  async function confirmReject() {
    if (rejectNote.trim().length < REJECT_NOTE_MIN_LENGTH) return;
    try {
      await reject.mutateAsync({ id: doctorId!, body: { note: rejectNote.trim() } });
      toast.success('Doctor rejected');
      setRejectOpen(false);
      setRejectNote('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not reject the doctor');
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 py-2">
      <QueryState query={doctor} label="this doctor">
        {(data) => (
          <>
      <Card className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
        <InitialsAvatar name={`${data.firstName} ${data.lastName}`} className="size-16" />
        <div className="flex flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="mr-1 text-2xl font-medium">
              {data.firstName} {data.lastName}
            </h1>
            <Badge variant={verificationVariant(data.verificationStatus)}>{data.verificationStatus}</Badge>
            <Badge variant="outline">{data.accountStatus}</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span>{data.email}</span>
            <span aria-hidden="true">·</span>
            <AdminAuditLink entityType="DoctorProfile" entityId={doctorId} />
          </div>
          {data.reviewNote && (
            <p className="text-sm text-muted-foreground">Review note: {data.reviewNote}</p>
          )}
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <div className="flex gap-2">
            <Button
              type="button"
              disabled={data.verificationStatus === 'APPROVED'}
              onClick={() => setApproveOpen(true)}
            >
              Approve
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-destructive text-destructive hover:bg-destructive/10"
              disabled={data.verificationStatus !== 'PENDING'}
              onClick={() => setRejectOpen(true)}
            >
              Reject
            </Button>
          </div>
          {data.verificationStatus === 'APPROVED' && (
            <p className="max-w-64 text-sm text-muted-foreground sm:text-right">
              Approved doctors can be suspended or deactivated from{' '}
              <Link to="/admin/users" className="font-semibold text-primary underline-offset-4 hover:underline">
                Users
              </Link>
              .
            </p>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Edit profile</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={(event) => void form.handleSubmit(onSubmit)(event)} className="flex flex-col gap-4">
            <DoctorProfileFormFields form={form} specializations={specializations.data} />
            <Button type="submit" disabled={updateProfile.isPending}>
              {updateProfile.isPending ? 'Saving…' : 'Save changes'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve this doctor?</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1">
            <Label htmlFor="approve-note">Note (optional)</Label>
            <Textarea id="approve-note" rows={3} value={approveNote} onChange={(e) => setApproveNote(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setApproveOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={approve.isPending} onClick={() => void confirmApprove()}>
              {approve.isPending ? 'Approving…' : 'Approve'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject this doctor?</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1">
            <Label htmlFor="reject-note">Note (required)</Label>
            <Textarea id="reject-note" rows={3} value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} />
            {rejectNote.length > 0 && rejectNote.trim().length < REJECT_NOTE_MIN_LENGTH && (
              <p className="text-sm text-destructive">At least {REJECT_NOTE_MIN_LENGTH} characters are required.</p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-destructive text-destructive hover:bg-destructive/10"
              disabled={reject.isPending || rejectNote.trim().length < REJECT_NOTE_MIN_LENGTH}
              onClick={() => void confirmReject()}
            >
              {reject.isPending ? 'Rejecting…' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
          </>
        )}
      </QueryState>
    </div>
  );
}
