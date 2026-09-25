import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { useLoginMutation } from '@/lib/auth/mutations';
import { roleHomePath } from '@/lib/auth/role-home';
import { sanitizeReturnTo } from '@/lib/return-to';

const signInSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type SignInValues = z.infer<typeof signInSchema>;

export function SignInPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const login = useLoginMutation();

  const form = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  });

  async function onSubmit(values: SignInValues) {
    try {
      const user = await login.mutateAsync(values);
      // `returnTo` is only honored when it's a safe, same-site path;
      // otherwise (missing or pointing off-site) the user lands on their
      // role's home page.
      const returnTo = sanitizeReturnTo(searchParams.get('returnTo'));
      await navigate(returnTo ?? roleHomePath(user.role), { replace: true });
    } catch {
      // Surfaced via `login.isError`/`login.error` in the render below.
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              onSubmit={(event) => void form.handleSubmit(onSubmit)(event)}
              className="flex flex-col gap-4"
            >
              {login.isError && (
                <Alert variant="destructive">
                  <AlertDescription>{login.error.message}</AlertDescription>
                </Alert>
              )}
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
                      <Input type="password" autoComplete="current-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={login.isPending}>
                {login.isPending ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>
          </Form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            New here?{' '}
            <Link
              to="/register/patient"
              className="text-primary underline-offset-4 hover:underline"
            >
              Create a patient account
            </Link>{' '}
            or{' '}
            <Link to="/register/doctor" className="text-primary underline-offset-4 hover:underline">
              register as a doctor
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
