import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { PrototypeNotice } from '@/components/prototype-notice';
import { useRegisterDoctorMutation } from '@/lib/auth/mutations';
import { roleHomePath } from '@/lib/auth/role-home';
import { useSpecializations } from '@/lib/use-specializations';
import { passwordSchema } from '@/lib/validation/password';
import { useDocumentTitle } from '@/lib/use-document-title';

const LICENSE_NUMBER_PATTERN = /^[A-Za-z0-9-]{4,32}$/;

const schema = z
  .object({
    firstName: z.string().min(1, 'First name is required').max(100),
    lastName: z.string().min(1, 'Last name is required').max(100),
    email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Please confirm your password'),
    licenseNumber: z.string().regex(LICENSE_NUMBER_PATTERN, '4-32 letters, digits, or dashes'),
    specializationIds: z.array(z.string()).min(1, 'Select at least one specialization'),
  })
  .refine((values) => values.password.toLowerCase() !== values.email.toLowerCase(), {
    message: 'Password must not equal the email',
    path: ['password'],
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type FormValues = z.infer<typeof schema>;

export function RegisterDoctorPage() {
  useDocumentTitle('Register as a doctor');
  const navigate = useNavigate();
  const register = useRegisterDoctorMutation();
  const specializations = useSpecializations();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      confirmPassword: '',
      licenseNumber: '',
      specializationIds: [],
    },
  });

  async function onSubmit(values: FormValues) {
    try {
      const user = await register.mutateAsync({
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        password: values.password,
        licenseNumber: values.licenseNumber,
        specializationIds: values.specializationIds,
      });
      await navigate(roleHomePath(user.role), { replace: true });
    } catch {
      // Surfaced via `register.isError`/`register.error` in the render below.
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6">
      <PrototypeNotice />
      <Card>
        <CardHeader>
          <CardTitle>Register as a doctor</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              onSubmit={(event) => void form.handleSubmit(onSubmit)(event)}
              className="flex flex-col gap-4"
            >
              {register.isError && (
                <Alert variant="destructive">
                  <AlertDescription>{register.error.message}</AlertDescription>
                </Alert>
              )}
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First name</FormLabel>
                      <FormControl>
                        <Input autoComplete="given-name" {...field} />
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
                        <Input autoComplete="family-name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" autoComplete="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" autoComplete="new-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm password</FormLabel>
                    <FormControl>
                      <Input type="password" autoComplete="new-password" {...field} />
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
              <FormField
                control={form.control}
                name="specializationIds"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Specializations</FormLabel>
                    <FormControl>
                      <div className="flex flex-col gap-2">
                        {specializations.isPending && (
                          <p className="text-sm text-muted-foreground">Loading…</p>
                        )}
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
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Button type="submit" disabled={register.isPending}>
                  {register.isPending ? 'Creating account…' : 'Create account'}
                </Button>
                <p className="text-xs text-muted-foreground">
                  By continuing you agree to the{' '}
                  <Link to="/terms" className="underline-offset-4 hover:underline">
                    Terms
                  </Link>{' '}
                  and{' '}
                  <Link to="/privacy" className="underline-offset-4 hover:underline">
                    Privacy policy
                  </Link>
                  .
                </p>
              </div>
            </form>
          </Form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link to="/login" className="text-primary underline-offset-4 hover:underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
