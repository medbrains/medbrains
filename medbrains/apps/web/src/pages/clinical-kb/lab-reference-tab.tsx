// Clinical-kb LabReferenceTab — split from clinical-kb.tsx (pure move).

import { Group, Stack, Text } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import { Badge, Input } from "@/components/ui";
import { ckbService } from "@/services/ckb.service";

export function LabReferenceTab() {
  const [search, setSearch] = useState("");
  const { data: analytes = [], isLoading } = useQuery({
    queryKey: ["ckb-lab-reference", search],
    queryFn: () => ckbService.listCkbLabReference(search.trim() || undefined),
  });
  const fmt = (n?: number | null) => (n === null || n === undefined ? "—" : String(n));

  return (
    <Stack>
      <Group justify="space-between">
        <Input
          placeholder="Search analyte or test"
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          w={320}
        />
        <Text size="xs" c="dimmed">
          Auto-flags critical results at result entry
        </Text>
      </Group>
      <DataTable
        columns={[
          {
            key: "analyte",
            label: "Analyte",
            render: (a) => (
              <Stack gap={0}>
                <Text size="sm" fw={600} tt="capitalize">
                  {a.analyte}
                </Text>
                {a.test ? (
                  <Text size="xs" c="dimmed">
                    {a.test}
                  </Text>
                ) : null}
              </Stack>
            ),
          },
          { key: "unit", label: "Unit", render: (a) => <Text size="sm">{a.unit ?? "—"}</Text> },
          {
            key: "normal",
            label: "Normal",
            render: (a) => (
              <Text size="sm">
                {fmt(a.normal_low)}–{fmt(a.normal_high)}
              </Text>
            ),
          },
          {
            key: "critical",
            label: "Critical",
            render: (a) =>
              a.critical_low !== null || a.critical_high !== null ? (
                <Badge tone="danger">
                  &lt;{fmt(a.critical_low)} / &gt;{fmt(a.critical_high)}
                </Badge>
              ) : (
                <Text size="sm" c="dimmed">
                  —
                </Text>
              ),
          },
          {
            key: "pregnancy",
            label: "Pregnancy",
            render: (a) =>
              a.pregnancy_low !== null || a.pregnancy_high !== null ? (
                <Text size="sm">
                  {fmt(a.pregnancy_low)}–{fmt(a.pregnancy_high)}
                </Text>
              ) : (
                <Text size="sm" c="dimmed">
                  —
                </Text>
              ),
          },
          {
            key: "elderly",
            label: "Elderly (≥65)",
            render: (a) =>
              a.elderly_low !== null || a.elderly_high !== null ? (
                <Text size="sm">
                  {fmt(a.elderly_low)}–{fmt(a.elderly_high)}
                </Text>
              ) : (
                <Text size="sm" c="dimmed">
                  —
                </Text>
              ),
          },
          {
            key: "category",
            label: "Category",
            render: (a) => (
              <Text size="sm" c="dimmed">
                {a.category ?? "—"}
              </Text>
            ),
          },
        ]}
        data={analytes}
        loading={isLoading}
        rowKey={(a) => a.analyte}
      />
    </Stack>
  );
}
