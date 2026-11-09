/**
 * Every request a MedBrains person made under one grant, newest first. A
 * request that never answered says so rather than looking like a success.
 */
import { Text } from "@mantine/core";
import { api } from "@medbrains/api";
import type { VendorAccessEvent } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import { Badge } from "@/components/ui";

const PER_PAGE = 200;

/** The status cell: what the server answered, or that it never did. */
function StatusCell({ event }: { event: VendorAccessEvent }) {
  if (event.status_code === null) return <Badge tone="warning">No answer</Badge>;
  const ok = event.status_code < 400;
  return (
    <Badge tone={ok ? "success" : "neutral"}>{`${event.status_code}${ok ? "" : " refused"}`}</Badge>
  );
}

/** The actions table for one grant, fetched only when shown. */
export function GrantEvents({ grantId }: { grantId: string }) {
  const [page, setPage] = useState(1);
  const events = useQuery({
    queryKey: ["vendor-access-events", grantId, page],
    queryFn: () => api.listVendorAccessEvents(grantId, page),
  });
  const total = events.data?.meta.total ?? 0;
  return (
    <DataTable
      data={events.data?.data ?? []}
      loading={events.isLoading}
      error={events.error}
      onRetry={() => void events.refetch()}
      rowKey={(e) => e.id}
      caption="Requests made under this grant"
      emptyTitle="Nothing done yet"
      emptyDescription="Requests appear here as they are made."
      total={total}
      page={page}
      perPage={PER_PAGE}
      totalPages={Math.max(1, Math.ceil(total / PER_PAGE))}
      onPageChange={setPage}
      columns={[
        {
          key: "when",
          label: "When",
          render: (e) => (
            <Text size="sm" ff="monospace">
              {new Date(e.created_at).toLocaleString()}
            </Text>
          ),
        },
        {
          key: "what",
          label: "Request",
          render: (e) => <Text size="sm" ff="monospace">{`${e.method} ${e.path}`}</Text>,
        },
        { key: "status", label: "Answer", render: (e) => <StatusCell event={e} /> },
        {
          key: "masked",
          label: "Patient data",
          render: (e) => <Text size="sm">{e.was_masked ? "Masked" : "Unmasked"}</Text>,
        },
      ]}
    />
  );
}
