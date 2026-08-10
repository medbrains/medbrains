/**
 * The shell every portal view shares: loading, failure, empty, or content.
 *
 * Its own file rather than living beside the page, so the views can use it
 * without importing the page that imports them.
 */

import { Loader, Stack, Text } from "@mantine/core";
import type { useQuery } from "@tanstack/react-query";
import { Alert, Card } from "@/components/ui";

export function PortalList<T>({
  query,
  empty,
  children,
}: {
  query: ReturnType<typeof useQuery<T[]>>;
  empty: string;
  children: (rows: T[]) => React.ReactNode;
}) {
  if (query.isLoading) {
    return <Loader size="sm" />;
  }
  if (query.isError) {
    return (
      <Alert tone="warning" title="We could not load this">
        Please try again in a moment, or ask at reception.
      </Alert>
    );
  }
  const rows = query.data ?? [];
  if (rows.length === 0) {
    return (
      <Card>
        <Text size="sm" p="md">
          {empty}
        </Text>
      </Card>
    );
  }
  return <Stack gap="sm">{children(rows)}</Stack>;
}
