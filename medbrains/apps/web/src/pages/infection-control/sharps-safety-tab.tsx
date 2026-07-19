// IPD SharpsSafetyTab — split from infection-control.tsx (pure move).

import { Group, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { NeedleStickIncident } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { DataTable } from "@/components";
import { Badge, Button } from "@/components/ui";
import { infectionControlService } from "@/services/infectionControl.service";

export function SharpsSafetyTab() {
  const canCreate = useHasPermission(P.INFECTION_CONTROL.SURVEILLANCE_CREATE);
  const { data: incidents = [], isLoading } = useQuery({
    queryKey: ["ic-needlestick"],
    queryFn: () => infectionControlService.listNeedleStickIncidents(),
  });

  const columns = [
    {
      key: "incident_number" as const,
      label: "Incident #",
      render: (r: NeedleStickIncident) => <Text fw={500}>{r.incident_number}</Text>,
    },
    {
      key: "incident_date" as const,
      label: "Date",
      render: (r: NeedleStickIncident) => new Date(r.incident_date).toLocaleDateString(),
    },
    {
      key: "device_type" as const,
      label: "Device Type",
      render: (r: NeedleStickIncident) => r.device_type,
    },
    {
      key: "body_part" as const,
      label: "Body Location",
      render: (r: NeedleStickIncident) => r.body_part ?? "---",
    },
    { key: "depth" as const, label: "Depth", render: (r: NeedleStickIncident) => r.depth ?? "---" },
    {
      key: "procedure_during" as const,
      label: "Procedure",
      render: (r: NeedleStickIncident) => r.procedure_during ?? "---",
    },
    {
      key: "pep_initiated" as const,
      label: "PEP Status",
      render: (r: NeedleStickIncident) => (
        <Badge tone={r.pep_initiated ? "success" : "danger"}>
          {r.pep_initiated ? "Initiated" : "Not Initiated"}
        </Badge>
      ),
    },
    {
      key: "source_status" as const,
      label: "Source Status",
      render: (r: NeedleStickIncident) => {
        const statuses = [];
        if (r.hiv_status) statuses.push(`HIV:${r.hiv_status}`);
        if (r.hbv_status) statuses.push(`HBV:${r.hbv_status}`);
        if (r.hcv_status) statuses.push(`HCV:${r.hcv_status}`);
        return statuses.length > 0 ? statuses.join(", ") : "---";
      },
    },
    {
      key: "outcome" as const,
      label: "Outcome",
      render: (r: NeedleStickIncident) => r.outcome ?? "---",
    },
  ];

  return (
    <Stack>
      <Group justify="space-between">
        <Text c="dimmed" size="sm">
          {incidents.length} incident(s)
        </Text>
        {canCreate && (
          <Button tone="primary" leftSection={<IconPlus size={16} />} disabled>
            Report Incident
          </Button>
        )}
      </Group>

      <DataTable
        columns={columns}
        data={incidents}
        loading={isLoading}
        rowKey={(r) => r.id}
        emptyTitle="No needle-stick incidents"
      />
    </Stack>
  );
}

// ── IC Analytics Tab ─────────────────────────────────────
