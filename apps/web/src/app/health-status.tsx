"use client";

import { readHealth } from "@aarili/api/client";
import { Button } from "@aarili/ui/components/button";
import { Status } from "@aarili/ui/components/status";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { useState } from "react";

export function HealthResult({
  result,
}: {
  result: Awaited<ReturnType<typeof readHealth>>;
}) {
  return "status" in result ? (
    <Status tone="success">Application and database are ready</Status>
  ) : (
    <Status tone="error">{result.error.message}</Status>
  );
}

function HealthQuery() {
  const query = useQuery({
    queryKey: ["operational-health"],
    queryFn: ({ signal }) =>
      readHealth(window.location.origin, { init: { signal } }),
    retry: false,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });
  return (
    <section aria-labelledby="health-heading" className="space-y-4 pt-6">
      <h2 id="health-heading">Service status</h2>
      <div role="status" aria-live="polite">
        {query.isFetching ? (
          <Status tone="info">Checking service status…</Status>
        ) : query.isError ? (
          <Status tone="warning">Service status could not be checked</Status>
        ) : query.data ? (
          <HealthResult result={query.data} />
        ) : null}
      </div>
      <Button disabled={query.isFetching} onClick={() => void query.refetch()}>
        Check again
      </Button>
      {query.isError ? (
        <p>Check your connection, then try again.</p>
      ) : query.data && "error" in query.data ? (
        <p>
          Check the local database and server configuration, then try again.
        </p>
      ) : null}
    </section>
  );
}

export function HealthStatus() {
  const [client] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={client}>
      <HealthQuery />
    </QueryClientProvider>
  );
}
