import { Link } from 'react-router';
import { buttonVariants } from '@/components/ui/button';

export function RootPage() {
  return (
    <main className="mx-auto flex max-w-xl flex-col items-center gap-4 p-16 text-center">
      <h1 className="text-3xl font-semibold">Telehealth</h1>
      <p className="text-muted-foreground">
        A fictional-prototype telehealth product. Sign in, or create a patient or doctor account to
        get started.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link to="/login" className={buttonVariants({ variant: 'default' })}>
          Sign in
        </Link>
        <Link to="/register/patient" className={buttonVariants({ variant: 'outline' })}>
          Create account
        </Link>
        <Link to="/register/doctor" className={buttonVariants({ variant: 'outline' })}>
          Register as a doctor
        </Link>
      </div>
      <Link
        to="/status"
        className="text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        View system status
      </Link>
    </main>
  );
}
