import { Link, useSearchParams } from 'react-router';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAdminDoctors } from '@/lib/admin/use-admin-doctors';
import { QueryState } from '@/components/query-state';
import { Pagination } from '@/components/pagination';

const PAGE_SIZE = 5;

type VerificationTab = 'PENDING' | 'APPROVED' | 'REJECTED';

function accountStatusVariant(status: string): 'default' | 'secondary' | 'destructive' {
  if (status === 'ACTIVE') return 'default';
  if (status === 'SUSPENDED') return 'secondary';
  return 'destructive';
}

export function AdminDoctorsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (searchParams.get('verification') as VerificationTab | null) ?? 'PENDING';
  const page = Number(searchParams.get('page') ?? '1') || 1;
  const doctors = useAdminDoctors({ verification: tab, page, pageSize: PAGE_SIZE });

  function setTab(next: string) {
    const params = new URLSearchParams(searchParams);
    params.set('verification', next);
    params.delete('page');
    setSearchParams(params);
  }

  function goToPage(next: number) {
    const params = new URLSearchParams(searchParams);
    if (next > 1) params.set('page', String(next));
    else params.delete('page');
    setSearchParams(params);
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Doctor reviews</h1>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="PENDING">Pending</TabsTrigger>
          <TabsTrigger value="APPROVED">Approved</TabsTrigger>
          <TabsTrigger value="REJECTED">Rejected</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4 flex flex-col gap-3">
          <QueryState
            query={doctors}
            label="doctors"
            isEmpty={(data) => data.items.length === 0}
            empty={<p className="text-muted-foreground">No doctors in this state.</p>}
          >
            {(data) => (
              <>
              {data.items.map((doctor) => (
                <Link key={doctor.id} to={`/admin/doctors/${doctor.id}`}>
                  <Card className="transition-colors hover:bg-accent/50">
                    <CardContent className="flex items-center justify-between gap-4 pt-6">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{doctor.displayName}</span>
                          <Badge variant={accountStatusVariant(doctor.accountStatus)}>{doctor.accountStatus}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{doctor.email}</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {doctor.specializations.map((s) => (
                            <Badge key={s.id} variant="secondary">
                              {s.name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {new Date(doctor.updatedAt).toLocaleDateString()}
                      </span>
                    </CardContent>
                  </Card>
                </Link>
              ))}
              <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={goToPage} />
              </>
            )}
          </QueryState>
        </TabsContent>
      </Tabs>
    </div>
  );
}
