// Command-center BedManagementTab — split from command-center.tsx (pure move).

import { Card, SimpleGrid, Stack, Text } from "@mantine/core";
import type { BedTurnaroundRow, PendingDischargeRow } from "@medbrains/types";
import { IconBed, IconDoorExit } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { DataTable } from "@/components";
import type { Column } from "@/components/DataTable";
import { Badge, type BadgeTone } from "@/components/ui";
import { commandCenterService } from "@/services/commandCenter.service";
import { fmtDate, fmtShortDate, REFETCH } from "./shared";

function bedStatusColor(s: string): BadgeTone {
  switch (s) {
    case "vacant_clean":
      return "success";
    case "occupied":
      return "primary";
    case "cleaning":
      return "warning";
    case "vacant_dirty":
      return "danger";
    case "maintenance":
      return "neutral";
    default:
      return "neutral";
  }
}

export function BedManagementTab() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["command-center", "turnaround-stats"],
    queryFn: () => commandCenterService.getTurnaroundStats(),
    refetchInterval: REFETCH,
  });

  const { data: beds, isLoading: bedsLoading } = useQuery({
    queryKey: ["command-center", "bed-turnaround"],
    queryFn: () => commandCenterService.getBedTurnaround(),
    refetchInterval: REFETCH,
  });

  const { data: pendingDischarges, isLoading: dischargesLoading } = useQuery({
    queryKey: ["command-center", "pending-discharges"],
    queryFn: () => commandCenterService.listPendingDischarges(),
    refetchInterval: REFETCH,
  });

  // Turnaround table columns
  const bedCols: Column<BedTurnaroundRow>[] = [
    { key: "location", label: "Location", render: (r) => <Text size="sm">{r.location_code}</Text> },
    { key: "ward", label: "Ward", render: (r) => <Text size="sm">{r.ward_name}</Text> },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <Badge tone={bedStatusColor(r.status)} size="sm" variant="filled">
          {r.status.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      key: "discharge_at",
      label: "Discharge Time",
      render: (r) => <Text size="xs">{fmtDate(r.discharge_at)}</Text>,
    },
    {
      key: "cleaning_started",
      label: "Cleaning Started",
      render: (r) => <Text size="xs">{fmtDate(r.cleaning_started_at)}</Text>,
    },
    {
      key: "cleaning_completed",
      label: "Completed",
      render: (r) => <Text size="xs">{fmtDate(r.cleaning_completed_at)}</Text>,
    },
    {
      key: "turnaround",
      label: "Turnaround (min)",
      render: (r) => (
        <Text
          size="sm"
          fw={500}
          c={r.turnaround_minutes != null && r.turnaround_minutes > 60 ? "danger" : undefined}
        >
          {r.turnaround_minutes != null ? r.turnaround_minutes : "-"}
        </Text>
      ),
    },
  ];

  // Discharge pipeline columns (compact view)
  const dischargeCols: Column<PendingDischargeRow>[] = [
    {
      key: "patient",
      label: "Patient",
      render: (r) => (
        <Text size="sm" fw={500}>
          {r.patient_name}
        </Text>
      ),
    },
    {
      key: "uhid",
      label: "UHID",
      render: (r) => (
        <Text size="xs" c="dimmed">
          {r.uhid}
        </Text>
      ),
    },
    { key: "ward", label: "Ward", render: (r) => <Text size="sm">{r.ward_name}</Text> },
    { key: "bed", label: "Bed", render: (r) => <Text size="sm">{r.bed_code}</Text> },
    {
      key: "expected",
      label: "Expected Discharge",
      render: (r) => {
        const isOverdue =
          r.expected_discharge_date && new Date(r.expected_discharge_date) < new Date();
        return (
          <Text size="sm" c={isOverdue ? "danger" : undefined} fw={isOverdue ? 600 : undefined}>
            {fmtShortDate(r.expected_discharge_date)}
          </Text>
        );
      },
    },
    { key: "days", label: "Days", render: (r) => <Text size="sm">{r.days_admitted}</Text> },
  ];

  return (
    <Stack gap="md">
      {/* Turnaround Stats Cards */}
      <Text size="sm" fw={600}>
        Ward Turnaround Statistics
      </Text>
      <SimpleGrid cols={4}>
        {(stats ?? []).map((s) => (
          <Card key={s.ward_name} p="md" withBorder>
            <Text size="sm" fw={600} mb="xs">
              {s.ward_name}
            </Text>
            <SimpleGrid cols={2} spacing="xs">
              <div>
                <Text size="xs" c="dimmed">
                  Avg Turnaround
                </Text>
                <Text size="lg" fw={700}>
                  {s.avg_turnaround_mins.toFixed(0)} min
                </Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">
                  Max Turnaround
                </Text>
                <Text size="lg" fw={700}>
                  {s.max_turnaround_mins.toFixed(0)} min
                </Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">
                  Awaiting Cleaning
                </Text>
                <Text size="lg" fw={700} c={s.beds_awaiting_cleaning > 0 ? "orange" : undefined}>
                  {s.beds_awaiting_cleaning}
                </Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">
                  Being Cleaned
                </Text>
                <Text size="lg" fw={700} c={s.beds_being_cleaned > 0 ? "primary" : undefined}>
                  {s.beds_being_cleaned}
                </Text>
              </div>
            </SimpleGrid>
          </Card>
        ))}
        {!statsLoading && (stats ?? []).length === 0 && (
          <Text size="sm" c="dimmed">
            No turnaround stats available
          </Text>
        )}
      </SimpleGrid>

      {/* Bed Turnaround Table */}
      <Text size="sm" fw={600}>
        Bed Turnaround Detail
      </Text>
      <DataTable<BedTurnaroundRow>
        columns={bedCols}
        data={beds ?? []}
        loading={bedsLoading}
        rowKey={(r) => r.location_id}
        emptyIcon={<IconBed size={40} />}
        emptyTitle="No bed turnaround data"
      />

      {/* Discharge Pipeline (compact) */}
      <Text size="sm" fw={600}>
        Discharge Pipeline
      </Text>
      <DataTable<PendingDischargeRow>
        columns={dischargeCols}
        data={(pendingDischarges ?? []).sort((a, b) => {
          const da = a.expected_discharge_date
            ? new Date(a.expected_discharge_date).getTime()
            : Number.MAX_SAFE_INTEGER;
          const db = b.expected_discharge_date
            ? new Date(b.expected_discharge_date).getTime()
            : Number.MAX_SAFE_INTEGER;
          return da - db;
        })}
        loading={dischargesLoading}
        rowKey={(r) => r.admission_id}
        emptyIcon={<IconDoorExit size={40} />}
        emptyTitle="No pending discharges"
      />
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Tab 3: Discharge Coordinator
// ══════════════════════════════════════════════════════════
