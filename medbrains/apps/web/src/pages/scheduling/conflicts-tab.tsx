// Scheduling ConflictsTab — split from scheduling.tsx (pure move).

import { Stack, Text } from "@mantine/core";
import type { SchedulingConflict } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { DataTable } from "@/components";
import type { Column } from "@/components/DataTable";
import { schedulingService } from "@/services/scheduling.service";
import { truncateId } from "./shared";

export function ConflictsTab() {
  const { data: conflicts = [], isLoading } = useQuery({
    queryKey: ["scheduling-conflicts"],
    queryFn: () => schedulingService.schedulingConflicts(),
  });

  const columns: Column<SchedulingConflict>[] = [
    {
      key: "resource_name",
      label: "Resource",
      render: (r) => (
        <Text size="sm" fw={500}>
          {r.resource_name}
        </Text>
      ),
    },
    {
      key: "resource_id",
      label: "Resource ID",
      render: (r) => (
        <Text size="sm" ff="monospace">
          {truncateId(r.resource_id)}
        </Text>
      ),
    },
    {
      key: "slot_a",
      label: "Slot A",
      render: (r) => (
        <Text size="sm" ff="monospace">
          {truncateId(r.slot_a_id)}
        </Text>
      ),
    },
    {
      key: "slot_b",
      label: "Slot B",
      render: (r) => (
        <Text size="sm" ff="monospace">
          {truncateId(r.slot_b_id)}
        </Text>
      ),
    },
    {
      key: "overlap",
      label: "Overlap Window",
      render: (r) => (
        <Text size="sm">
          {new Date(r.overlap_start).toLocaleString()} — {new Date(r.overlap_end).toLocaleString()}
        </Text>
      ),
    },
  ];

  return (
    <Stack gap="md">
      <Text fw={600} size="lg">
        Schedule Conflicts
      </Text>
      <DataTable<SchedulingConflict>
        columns={columns}
        data={conflicts}
        loading={isLoading}
        rowKey={(r) => `${r.slot_a_id}-${r.slot_b_id}`}
        emptyTitle="No conflicts detected"
        emptyDescription="All schedule slots are conflict-free"
      />
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Tab — Recurring Appointments & Block Scheduling
// ══════════════════════════════════════════════════════════
