import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { usePatientProfile, useUpdatePatientProfile } from '@/lib/patients/use-patient-profile';
import {
  patientProfileSchema,
  type PatientProfileFormInput,
  type PatientProfileFormValues,
} from '@/lib/patients/patient-profile-schema';
import { QueryState } from '@/components/query-state';
import { SignOutEverywhereCard } from '@/components/sign-out-everywhere-card';

function toFormValues(profile: {
  firstName: string;
  lastName: string;
  birthDate: string | null;
  weightKg: number | null;
  heightCm: number | null;
  phone: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  medicalConditions: string | null;
  allergies: string | null;
  currentMedications: string | null;
}): PatientProfileFormInput {
  return {
    firstName: profile.firstName,
    lastName: profile.lastName,
    birthDate: profile.birthDate ?? '',
    weightKg: profile.weightKg ?? undefined,
    heightCm: profile.heightCm ?? undefined,
    phone: profile.phone ?? '',
    emergencyContactName: profile.emergencyContactName ?? '',
    emergencyContactPhone: profile.emergencyContactPhone ?? '',
    medicalConditions: profile.medicalConditions ?? '',
    allergies: profile.allergies ?? '',
    currentMedications: profile.currentMedications ?? '',
  };
}

export function PatientProfilePage() {
  const profile = usePatientProfile();
  const update = useUpdatePatientProfile();

  const form = useForm<PatientProfileFormInput, unknown, PatientProfileFormValues>({
    resolver: zodResolver(patientProfileSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      birthDate: '',
      phone: '',
      emergencyContactName: '',
      emergencyContactPhone: '',
      medicalConditions: '',
      allergies: '',
      currentMedications: '',
    },
  });

  useEffect(() => {
    if (profile.data) {
      form.reset(toFormValues(profile.data));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when fresh server data arrives
  }, [profile.data]);

  async function onSubmit(values: PatientProfileFormValues) {
    try {
      await update.mutateAsync(values);
      toast.success('Profile saved');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save your profile');
    }
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <h1 className="text-2xl font-semibold">Your profile</h1>
      <QueryState query={profile} label="your profile">
        {() => (
      <Card>
        <CardHeader>
          <CardTitle>Personal details</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              onSubmit={(event) => void form.handleSubmit(onSubmit)(event)}
              className="flex flex-col gap-4"
            >
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="birthDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Birthday</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        value={(field.value as string | undefined) ?? ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="weightKg"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Weight (kg)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.1"
                          {...field}
                          value={(field.value as number | string | undefined) ?? ''}
                          onChange={(event) => field.onChange(event.target.value)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="heightCm"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Height (cm)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.1"
                          {...field}
                          value={(field.value as number | string | undefined) ?? ''}
                          onChange={(event) => field.onChange(event.target.value)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone number</FormLabel>
                    <FormControl>
                      <Input {...field} value={(field.value as string | undefined) ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="emergencyContactName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Emergency contact name</FormLabel>
                      <FormControl>
                        <Input {...field} value={(field.value as string | undefined) ?? ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="emergencyContactPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Emergency contact phone</FormLabel>
                      <FormControl>
                        <Input {...field} value={(field.value as string | undefined) ?? ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="medicalConditions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Medical conditions</FormLabel>
                    <FormControl>
                      <Textarea {...field} value={(field.value as string | undefined) ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="allergies"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Allergies</FormLabel>
                    <FormControl>
                      <Textarea {...field} value={(field.value as string | undefined) ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="currentMedications"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current medications</FormLabel>
                    <FormControl>
                      <Textarea {...field} value={(field.value as string | undefined) ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={update.isPending}>
                {update.isPending ? 'Saving…' : 'Save changes'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
        )}
      </QueryState>
      <SignOutEverywhereCard />
    </div>
  );
}
