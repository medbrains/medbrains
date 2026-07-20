// Command-center DischargeCoordinatorTab — split from command-center.tsx (pure move).

import { Group, SimpleGrid, Stack, Text } from "@mantine/core";
import type { PendingDischargeRow } from "@medbrains/types";
import {
  IconAlertTriangle,
  IconCheck,
  IconClipboardCheck,
  IconDoorExit,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { DataTable, StatCard } from "@/components";
import type { Column } from "@/components/DataTable";
import { Badge } from "@/components/ui";
import { commandCenterService } from "@/services/commandCenter.service";
import { fmtShortDate, REFETCH } from "./shared";

export function DischargeCoordinatorTab() {
  const { data: pendingDischarges, isLoading } = useQuery({
    queryKey: ["command-center", "pending-discharges"],
    queryFn: () => commandCenterService.listPendingDischarges(),
    refetchInterval: REFETCH,
  });

  const sorted = [...(pendingDischarges ?? [])].sort((a, b) => {
    const da = a.expected_discharge_date
      ? new Date(a.expected_discharge_date).getTime()
      : Number.MAX_SAFE_INTEGER;
    const db = b.expected_discharge_date
      ? new Date(b.expected_discharge_date).getTime()
      : Number.MAX_SAFE_INTEGER;
    return da - db;
  });

  const cols: Column<PendingDischargeRow>[] = [
    {
      key: "patient",
      label: "Patient",
      render: (r) => (
        <div>
          <Text size="sm" fw={500}>
            {r.patient_name}
          </Text>
          <Text size="xs" c="dimmed">
            {r.uhid}
          </Text>
        </div>
      ),
    },
    { key: "ward", label: "Ward", render: (r) => <Text size="sm">{r.ward_name}</Text> },
    { key: "bed", label: "Bed", render: (r) => <Text size="sm">{r.bed_code}</Text> },
    { key: "doctor", label: "Doctor", render: (r) => <Text size="sm">{r.doctor_name}</Text> },
    {
      key: "admitted",
      label: "Admitted",
      render: (r) => <Text size="xs">{fmtShortDate(r.admitted_at)}</Text>,
    },
    {
      key: "expected",
      label: "Expected Discharge",
      render: (r) => {
        const isOverdue =
          r.expected_discharge_date && new Date(r.expected_discharge_date) < new Date();
        return (
          <Group gap={4}>
            <Text size="sm" c={isOverdue ? "danger" : undefined} fw={isOverdue ? 600 : undefined}>
              {fmtShortDate(r.expected_discharge_date)}
            </Text>
            {isOverdue && (
              <Badge size="xs" tone="danger" variant="filled">
                OVERDUE
              </Badge>
            )}
          </Group>
        );
      },
    },
    {
      key: "days",
      label: "Days",
      render: (r) => (
        <Text size="sm" fw={500}>
          {r.days_admitted}
        </Text>
      ),
    },
    {
      key: "blockers",
      label: "Blockers",
      render: (r) => {
        const badges: React.ReactNode[] = [];
        if (r.pending_labs > 0) {
          badges.push(
            <Badge key="labs" size="xs" tone="danger" variant="filled">
              Labs ({r.pending_labs})
            </Badge>,
          );
        }
        if (r.pending_billing) {
          badges.push(
            <Badge key="billing" size="xs" tone="warning" variant="filled">
              Billing
            </Badge>,
          );
        }
        if (r.summary_draft) {
          badges.push(
            <Badge key="summary" size="xs" tone="warning" variant="filled">
              Summary
            </Badge>,
          );
        }
        if (r.checklist_pending > 0) {
          badges.push(
            <Badge key="checklist" size="xs" tone="warning" variant="filled">
              Checklist ({r.checklist_pending})
            </Badge>,
          );
        }
        if (badges.length === 0) {
          return (
            <Badge size="xs" tone="success" variant="light">
              Clear
            </Badge>
          );
        }
        return <Group gap={4}>{badges}</Group>;
      },
    },
  ];

  // Summary stats
  const total = sorted.length;
  const overdue = sorted.filter(
    (r) => r.expected_discharge_date && new Date(r.expected_discharge_date) < new Date(),
  ).length;
  const withBlockers = sorted.filter(
    (r) => r.pending_labs > 0 || r.pending_billing || r.summary_draft || r.checklist_pending > 0,
  ).length;

  return (
    <Stack gap="md">
      {/* Summary Stats */}
      <SimpleGrid cols={4}>
        <StatCard
          label="Total Pending"
          value={total}
          icon={<IconDoorExit size={18} />}
          color="primary"
        />
        <StatCard
          label="Overdue"
          value={overdue}
          icon={<IconAlertTriangle size={18} />}
          color="danger"
        />
        <StatCard
          label="With Blockers"
          value={withBlockers}
          icon={<IconClipboardCheck size={18} />}
          color="orange"
        />
        <StatCard
          label="Ready to Discharge"
          value={total - withBlockers}
          icon={<IconCheck size={18} />}
          color="success"
        />
      </SimpleGrid>

      {/* Pending Discharges Table */}
      <DataTable<PendingDischargeRow>
        columns={cols}
        data={sorted}
        loading={isLoading}
        rowKey={(r) => r.admission_id}
        emptyIcon={<IconDoorExit size={40} />}
        emptyTitle="No pending discharges"
        emptyDescription="All patients have been discharged"
        rowStyle={(r) => {
          if (r.expected_discharge_date && new Date(r.expected_discharge_date) < new Date()) {
            return { backgroundColor: "var(--mantine-color-red-0)" };
          }
          return undefined;
        }}
      />
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Tab 4: Transport
// ══════════════════════════════════════════════════════════
