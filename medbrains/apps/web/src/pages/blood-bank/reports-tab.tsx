// BLOOD-BANK ReportsTab — split from blood-bank.tsx (pure move).

import { Divider, Paper, SegmentedControl, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { HemovigilanceRow, TtiReportRow } from "@medbrains/types";
import { P } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { DataTable } from "@/components";
import { Badge, type BadgeTone } from "@/components/ui";
import { bloodBankService } from "@/services/bloodBank.service";

const ttiStatusColors: Record<string, BadgeTone> = {
  tested: "success",
  pending: "warning",
  reactive: "danger",
  non_reactive: "success",
};

function TtiReportView() {
  // TTI screening results sit behind `blood_bank.inventory.list`, and the
  // haemovigilance report behind `blood_bank.transfusion.list`. Neither was
  // gated, and an empty haemovigilance report reads as "no transfusion
  // reactions" — which is exactly the number a blood bank reports to NACO.
  const canListInventory = useHasPermission(P.BLOOD_BANK.INVENTORY_LIST);
  const { data, isLoading } = useQuery({
    queryKey: ["blood-bank", "tti-report"],
    queryFn: () => bloodBankService.getTtiReport(),
    enabled: canListInventory,
  });

  const reactiveCount = useMemo(
    () =>
      (data?.by_status ?? [])
        .filter((r) => r.tti_status === "reactive")
        .reduce((sum, r) => sum + r.count, 0),
    [data],
  );

  const reactivePct = data?.total_components
    ? ((reactiveCount / data.total_components) * 100).toFixed(2)
    : "0.00";

  const columns = [
    {
      key: "tti_status" as const,
      label: "TTI Status",
      render: (r: TtiReportRow) => (
        <Badge tone={ttiStatusColors[r.tti_status] ?? "neutral"}>
          {r.tti_status.replace(/_/g, " ")}
        </Badge>
      ),
    },
    { key: "count" as const, label: "Count", render: (r: TtiReportRow) => String(r.count) },
  ];

  return (
    <Stack>
      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        <Paper p="md" withBorder>
          <Text size="xs" c="dimmed">
            Total Components Tested
          </Text>
          <Title order={3}>{data?.total_components ?? 0}</Title>
        </Paper>
        <Paper p="md" withBorder>
          <Text size="xs" c="dimmed">
            Reactive
          </Text>
          <Title order={3} c="danger">
            {reactiveCount}
          </Title>
        </Paper>
        <Paper p="md" withBorder>
          <Text size="xs" c="dimmed">
            Reactive Rate
          </Text>
          <Title order={3} c={Number(reactivePct) > 0 ? "danger" : "success"}>
            {reactivePct}%
          </Title>
        </Paper>
      </SimpleGrid>

      <Divider />

      <DataTable
        columns={columns}
        data={data?.by_status ?? []}
        loading={isLoading}
        rowKey={(r) => r.tti_status}
      />
    </Stack>
  );
}

function HemovigilanceView() {
  const canListTransfusion = useHasPermission(P.BLOOD_BANK.TRANSFUSION_LIST);
  const { data, isLoading } = useQuery({
    queryKey: ["blood-bank", "hemovigilance"],
    queryFn: () => bloodBankService.getHemovigilanceReport(),
    enabled: canListTransfusion,
  });

  const columns = [
    {
      key: "reaction_type" as const,
      label: "Reaction Type",
      render: (r: HemovigilanceRow) => r.reaction_type ?? "Unknown",
    },
    {
      key: "severity" as const,
      label: "Severity",
      render: (r: HemovigilanceRow) =>
        r.severity ? (
          <Badge
            tone={
              r.severity === "severe" || r.severity === "fatal"
                ? "danger"
                : r.severity === "moderate"
                  ? "warning"
                  : "warning"
            }
          >
            {r.severity}
          </Badge>
        ) : (
          <Text size="sm" c="dimmed">
            N/A
          </Text>
        ),
    },
    { key: "count" as const, label: "Count", render: (r: HemovigilanceRow) => String(r.count) },
  ];

  return (
    <Stack>
      <SimpleGrid cols={{ base: 1, sm: 4 }}>
        <Paper p="md" withBorder>
          <Text size="xs" c="dimmed">
            Reporting Period
          </Text>
          <Title order={4}>{data?.reporting_period ?? "—"}</Title>
        </Paper>
        <Paper p="md" withBorder>
          <Text size="xs" c="dimmed">
            Total Transfusions
          </Text>
          <Title order={3}>{data?.total_transfusions ?? 0}</Title>
        </Paper>
        <Paper p="md" withBorder>
          <Text size="xs" c="dimmed">
            Total Reactions
          </Text>
          <Title order={3} c="danger">
            {data?.total_reactions ?? 0}
          </Title>
        </Paper>
        <Paper p="md" withBorder>
          <Text size="xs" c="dimmed">
            Reaction Rate
          </Text>
          <Title
            order={3}
            c={data?.reaction_rate_percent && data.reaction_rate_percent > 0 ? "orange" : "success"}
          >
            {data?.reaction_rate_percent?.toFixed(2) ?? "0.00"}%
          </Title>
        </Paper>
      </SimpleGrid>

      <Divider />

      <DataTable
        columns={columns}
        data={data?.reactions_by_type ?? []}
        loading={isLoading}
        rowKey={(r) => `${r.reaction_type ?? "unknown"}-${r.severity ?? "unknown"}`}
      />
    </Stack>
  );
}

export function ReportsTab() {
  const [reportView, setReportView] = useState("tti");

  return (
    <Stack mt="md">
      <SegmentedControl
        value={reportView}
        onChange={setReportView}
        data={[
          { value: "tti", label: "TTI Report" },
          { value: "hemovigilance", label: "Hemovigilance" },
        ]}
        w={320}
      />

      {reportView === "tti" && <TtiReportView />}
      {reportView === "hemovigilance" && <HemovigilanceView />}
    </Stack>
  );
}
