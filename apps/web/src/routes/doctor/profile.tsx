import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useDoctorProfile, useUpdateDoctorProfile } from '@/lib/doctors/use-doctor-profile';
import {
  CONSULTATION_MINUTES,
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
                name="bio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Biography</FormLabel>
                    <FormControl>
                      <Textarea {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="yearsOfExperience"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Years of experience</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
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
                  name="licenseNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>License number</FormLabel>
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
                name="consultationMinutes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Consultation length</FormLabel>
                    <Select
                      value={String(field.value)}
                      onValueChange={(value) => field.onChange(Number(value))}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CONSULTATION_MINUTES.map((minutes) => (
                          <SelectItem key={minutes} value={String(minutes)}>
                            {minutes} minutes
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="specializationIds"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Specializations</FormLabel>
                    <FormControl>
                      <div className="flex flex-col gap-2">
                        {specializations.data?.map((specialization) => {
                          const checked = field.value.includes(specialization.id);
                          return (
                            <label
                              key={specialization.id}
                              className="flex items-center gap-2 text-sm"
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(next) => {
                                  field.onChange(
                                    next
                                      ? [...field.value, specialization.id]
                                      : field.value.filter((id) => id !== specialization.id),
                                  );
                                }}
                              />
                              {specialization.name}
                            </label>
                          );
                        })}
                      </div>
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
    </div>
  );
}
