/**
 * Ward / compliance verbal & telephone order countersign register.
 *
 * NABH/JCI medication-safety evidence: every order a doctor gives verbally or
 * by telephone (transcribed by a nurse with read-back) must be countersigned
 * within the deadline. This register is the audit view of that loop — who
 * ordered, who transcribed, whether read-back was confirmed, and whether the
 * countersignature landed on time, late, or is still overdue.
 */
import { Group, Stack, Text, Tooltip } from "@mantine/core";
import { useAuthStore } from "@medbrains/stores";
import type {
  PendingSignoffEntry,
  VerbalOrderComplianceStatus,
  VerbalOrderEntry,
} from "@medbrains/types";
import {
  IconAlertTriangle,
  IconCircleCheck,
  IconClock,
  IconPhone,
  IconSignature,
  IconVolume,
} from "@tabler/icons-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { Column, DataTableFilter } from "@/components/DataTable";
import { DataTable } from "@/components/DataTable";
import { SignWorkspace } from "@/components/Doctor/SignWorkspace";
import { Badge, type BadgeTone, IconButton } from "@/components/ui";
import { signoffService } from "@/services/signoff.service";

/** Build the SignWorkspace target for a verbal order the prescriber owns. */
function toSignTarget(r: VerbalOrderEntry): PendingSignoffEntry {
  return {
    record_type: "prescription",
    record_id: r.id,
    created_at: r.created_at,
    legal_class: "clinical",
    patient_id: r.patient_id ?? null,
    patient_name: r.patient_name ?? null,
    uhid: r.uhid ?? null,
    summary: r.summary ?? null,
    context: null,
    risk_label: null,
    order_mode: r.order_mode,
    countersign_due_at: r.countersign_due_at ?? null,
    transcribed: r.transcribed_by != null,
  };
}

const COMPLIANCE: Record<VerbalOrderComplianceStatus, { label: string; tone: BadgeTone }> = {
  awaiting: { label: "Awaiting", tone: "info" },
  overdue: { label: "Overdue", tone: "danger" },
  countersigned_on_time: { label: "On time", tone: "success" },
  countersigned_late: { label: "Late", tone: "warning" },
};

function formatDateTime(value?: string | null): string {
  return value ? new Date(value).toLocaleString() : "—";
}

export function VerbalOrderRegister() {
  const currentUserId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();
  const [signTarget, setSignTarget] = useState<PendingSignoffEntry | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["verbal-order-register"],
    queryFn: () => signoffService.listVerbalOrders(),
    refetchInterval: 60_000,
  });

  // The prescriber can countersign their own un-signed order inline.
  const canCountersign = (r: VerbalOrderEntry) =>
    !r.is_signed && r.ordering_doctor_id != null && r.ordering_doctor_id === currentUserId;

  const columns: Column<VerbalOrderEntry>[] = [
    {
      key: "patient",
      label: "Patient",
      searchable: true,
      accessor: (r) => `${r.patient_name ?? ""} ${r.uhid ?? ""}`.trim(),
      render: (r) => (
        <Stack gap={0}>
          <Text size="sm" fw={600} lineClamp={1}>
            {r.patient_name || "Unknown patient"}
          </Text>
          {r.uhid && (
            <Text size="xs" c="dimmed" ff="monospace">
              {r.uhid}
            </Text>
          )}
        </Stack>
      ),
    },
    {
      key: "mode",
      label: "Mode",
      sortable: true,
      accessor: (r) => r.order_mode,
      render: (r) =>
        r.order_mode === "telephone" ? (
          <Badge size="xs" tone="warning" leftSection={<IconPhone size={10} />}>
            Telephone
          </Badge>
        ) : (
          <Badge size="xs" tone="info" leftSection={<IconVolume size={10} />}>
            Verbal
          </Badge>
        ),
    },
    {
      key: "order",
      label: "Order",
      searchable: true,
      accessor: (r) => r.summary ?? "",
      render: (r) => (
        <Text size="sm" lineClamp={2}>
          {r.summary || "—"}
        </Text>
      ),
    },
    {
      key: "ordering_doctor",
      label: "Ordered by",
      sortable: true,
      searchable: true,
      accessor: (r) => r.ordering_doctor_name ?? "",
      render: (r) => <Text size="sm">{r.ordering_doctor_name || "—"}</Text>,
    },
    {
      key: "transcribed_by",
      label: "Transcribed by",
      searchable: true,
      accessor: (r) => r.transcribed_by_name ?? "",
      render: (r) => (
        <Text size="sm" c={r.transcribed_by_name ? undefined : "dimmed"}>
          {r.transcribed_by_name || "—"}
        </Text>
      ),
    },
    {
      key: "read_back",
      label: "Read-back",
      sortable: true,
      accessor: (r) => (r.read_back_confirmed ? "yes" : "no"),
      render: (r) =>
        r.read_back_confirmed ? (
          <Badge size="xs" tone="success" leftSection={<IconCircleCheck size={10} />}>
            Confirmed
          </Badge>
        ) : (
          <Badge size="xs" tone="danger" leftSection={<IconAlertTriangle size={10} />}>
            Missing
          </Badge>
        ),
    },
    {
      key: "due",
      label: "Countersign due",
      sortable: true,
      sortValue: (r) => (r.countersign_due_at ? new Date(r.countersign_due_at).getTime() : 0),
      accessor: (r) => formatDateTime(r.countersign_due_at),
      render: (r) => (
        <Group gap={4} wrap="nowrap">
          <IconClock size={12} stroke={1.5} />
          <Text size="xs">{formatDateTime(r.countersign_due_at)}</Text>
        </Group>
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      accessor: (r) => COMPLIANCE[r.compliance_status].label,
      render: (r) => {
        const c = COMPLIANCE[r.compliance_status];
        return (
          <Badge size="xs" tone={c.tone}>
            {r.is_signed && r.countersigned_at
              ? `${c.label} • ${formatDateTime(r.countersigned_at)}`
              : c.label}
          </Badge>
        );
      },
    },
    {
      key: "action",
      label: "",
      render: (r) =>
        canCountersign(r) ? (
          <Tooltip label="Countersign now" withArrow>
            <IconButton
              tone="primary"
              size="sm"
              aria-label={`Countersign verbal order for ${r.patient_name ?? "patient"}`}
              onClick={() => setSignTarget(toSignTarget(r))}
            >
              <IconSignature size={16} />
            </IconButton>
          </Tooltip>
        ) : null,
    },
  ];

  const filters: DataTableFilter<VerbalOrderEntry>[] = [
    {
      key: "compliance",
      label: "Compliance",
      options: [
        { value: "awaiting", label: "Awaiting" },
        { value: "overdue", label: "Overdue" },
        { value: "countersigned_on_time", label: "On time" },
        { value: "countersigned_late", label: "Late" },
      ],
      matches: (r, value) => r.compliance_status === value,
    },
    {
      key: "mode",
      label: "Mode",
      options: [
        { value: "verbal", label: "Verbal" },
        { value: "telephone", label: "Telephone" },
      ],
      matches: (r, value) => r.order_mode === value,
    },
  ];

  return (
    <>
      <DataTable<VerbalOrderEntry>
        columns={columns}
        data={rows}
        loading={isLoading}
        rowKey={(r) => r.id}
        searchable
        searchPlaceholder="Search patient, doctor, nurse, order"
        filters={filters}
        exportable
        exportFileName="verbal-order-register"
        emptyIcon={<IconVolume size={28} stroke={1.5} />}
        emptyTitle="No verbal or telephone orders"
      />

      {signTarget && (
        <SignWorkspace
          opened={!!signTarget}
          target={signTarget}
          onClose={() => setSignTarget(null)}
          onSigned={() => {
            setSignTarget(null);
            void queryClient.invalidateQueries({ queryKey: ["verbal-order-register"] });
          }}
        />
      )}
    </>
  );
}
