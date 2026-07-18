// Billing AuditLogTab — split from billing.tsx (pure move).

import { Group, Select, Stack, Text } from "@mantine/core";
import type { BillingAuditEntry } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import { Badge } from "@/components/ui";
import { statusColor } from "@/lib/status-colors";
import { billingService } from "@/services/billing.service";
import { toBadgeTone } from "./shared";

export function AuditLogTab() {
  const [page, setPage] = useState(1);
  const [filterAction, setFilterAction] = useState<string | null>(null);

  const params: Record<string, string> = { page: String(page), per_page: "30" };
  if (filterAction) params.action = filterAction;

  const { data, isLoading } = useQuery({
    queryKey: ["billing-audit-log", params],
    queryFn: () => billingService.listBillingAuditLog(params),
  });

  const columns = [
    {
      key: "created_at",
      label: "Time",
      render: (row: BillingAuditEntry) => (
        <Text size="sm">{new Date(row.created_at).toLocaleString()}</Text>
      ),
    },
    {
      key: "action",
      label: "Action",
      render: (row: BillingAuditEntry) => (
        <Badge size="sm" tone={toBadgeTone(statusColor(row.action))}>
          {row.action.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      key: "entity_type",
      label: "Entity",
      render: (row: BillingAuditEntry) => <Text size="sm">{row.entity_type}</Text>,
    },
    {
      key: "amount",
      label: "Amount",
      render: (row: BillingAuditEntry) => (
        <Text size="sm">{row.amount ? `₹${row.amount}` : "—"}</Text>
      ),
    },
    {
      key: "performed_by",
      label: "By",
      render: (row: BillingAuditEntry) => <Text size="sm">{row.performed_by ?? "—"}</Text>,
    },
  ];

  return (
    <Stack>
      <Group>
        <Select
          placeholder="Filter by action"
          data={[
            "invoice_created",
            "invoice_issued",
            "invoice_cancelled",
            "payment_recorded",
            "payment_voided",
            "refund_created",
            "discount_applied",
            "advance_collected",
            "advance_adjusted",
            "credit_note_created",
            "claim_created",
            "day_closed",
            "write_off_created",
            "write_off_approved",
            "invoice_cloned",
          ].map((a) => ({ value: a, label: a.replace(/_/g, " ") }))}
          value={filterAction}
          onChange={setFilterAction}
          clearable
          w={220}
        />
      </Group>
      <DataTable
        columns={columns}
        data={data?.entries ?? []}
        loading={isLoading}
        page={page}
        totalPages={data ? Math.ceil(data.total / data.per_page) : 1}
        onPageChange={setPage}
        rowKey={(row) => row.id}
      />
    </Stack>
  );
}

/* ─── Credit Patients Tab ────────────────────────────────────────── */
