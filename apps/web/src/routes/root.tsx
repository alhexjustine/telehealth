import { Link } from 'react-router';
import { buttonVariants } from '@/components/ui/button';

export function RootPage() {
  return (
    <main className="mx-auto flex max-w-xl flex-col items-center gap-4 p-16 text-center">
      <h1 className="text-3xl font-semibold">Telehealth</h1>
      <p className="text-muted-foreground">
        A fictional-prototype telehealth product. The patient, doctor, and admin experiences are
        built out in later changes.
      </p>
      <Link to="/status" className={buttonVariants({ variant: 'default' })}>
        View system status
      </Link>
    </main>
  );
}
