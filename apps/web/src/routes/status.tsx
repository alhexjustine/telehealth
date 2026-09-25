import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface HealthIndicator {
  status: 'up' | 'down';
}

interface HealthReport {
  status: 'ok' | 'error' | 'degraded' | 'shutting_down';
  details?: Record<string, HealthIndicator>;
}

async function fetchHealth(): Promise<HealthReport> {
  const { data, error, response } = await apiClient.GET('/health');
  const body = (data ?? error) as HealthReport | undefined;
  if (!body) {
    throw new Error(`Health check failed with status ${response.status}`);
  }
  return body;
}

export function StatusPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
    retry: false,
  });

  const databaseStatus = data?.details?.database?.status;
  const isHealthy = data?.status === 'ok';

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 p-8">
      <h1 className="text-2xl font-semibold">System status</h1>
      <Card>
        <CardHeader>
          <CardTitle>API</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <p data-testid="api-status">Checking…</p>}
          {isError && (
            <p data-testid="api-status" className="text-destructive">
              Unreachable
            </p>
          )}
          {data && (
            <p
              data-testid="api-status"
              className={cn(isHealthy ? 'text-success' : 'text-destructive')}
            >
              {isHealthy ? 'Healthy' : 'Unhealthy'}
            </p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Database</CardTitle>
        </CardHeader>
        <CardContent>
          {!databaseStatus && <p data-testid="database-status">Unknown</p>}
          {databaseStatus && (
            <p
              data-testid="database-status"
              className={cn(databaseStatus === 'up' ? 'text-success' : 'text-destructive')}
            >
              {databaseStatus === 'up' ? 'Up' : 'Down'}
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
