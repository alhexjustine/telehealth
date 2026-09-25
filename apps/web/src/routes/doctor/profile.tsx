import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DoctorProfileFormFields } from '@/components/doctor-profile-form-fields';
import { useDoctorProfile, useUpdateDoctorProfile } from '@/lib/doctors/use-doctor-profile';
import {
  doctorProfileSchema,
  type DoctorProfileFormInput,
  type DoctorProfileFormValues,
} from '@/lib/doctors/doctor-profile-schema';
import { useSpecializations } from '@/lib/use-specializations';

export function DoctorProfilePage() {
  const profile = useDoctorProfile();
  const update = useUpdateDoctorProfile();
  const specializations = useSpecializations();

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
    if (profile.data) {
      form.reset({
        firstName: profile.data.firstName,
        lastName: profile.data.lastName,
        bio: profile.data.bio ?? '',
        yearsOfExperience: profile.data.yearsOfExperience ?? undefined,
        licenseNumber: profile.data.licenseNumber,
        consultationMinutes: profile.data.consultationMinutes,
        specializationIds: profile.data.specializations.map((s) => s.id),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when fresh server data arrives
  }, [profile.data]);

  async function onSubmit(values: DoctorProfileFormValues) {
    try {
      // `consultationMinutes` is validated by the zod schema to be one of the
      // allowed values, but its inferred type widens to `number`; the OpenAPI
      // body type wants the literal union back.
      await update.mutateAsync({
        ...values,
        consultationMinutes: values.consultationMinutes as 15 | 20 | 30 | 45 | 60,
      });
      toast.success('Profile saved');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save your profile');
    }
  }

  if (profile.isPending) {
    return <p className="text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-semibold">Your profile</h1>
        {profile.data && <Badge variant="outline">{profile.data.verificationStatus}</Badge>}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Professional details</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(event) => void form.handleSubmit(onSubmit)(event)}
            className="flex flex-col gap-4"
          >
            <DoctorProfileFormFields form={form} specializations={specializations.data} />
            <Button type="submit" disabled={update.isPending}>
              {update.isPending ? 'Saving…' : 'Save changes'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
