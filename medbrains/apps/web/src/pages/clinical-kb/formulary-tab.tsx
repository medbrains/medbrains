// Clinical-kb FormularyTab — split from clinical-kb.tsx (pure move).

import { Group, Stack, Text } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import { Badge, Input } from "@/components/ui";
import { ckbService } from "@/services/ckb.service";

export function FormularyTab() {
  const [search, setSearch] = useState("");
  const { data: drugs = [], isLoading } = useQuery({
    queryKey: ["ckb-formulary", search],
    queryFn: () => ckbService.listCkbFormulary(search.trim() || undefined),
  });

  return (
    <Stack>
      <Group justify="space-between">
        <Input
          placeholder="Search generic drug"
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          w={320}
        />
        <Text size="xs" c="dimmed">
          CDS reference — feeds dose / renal / hepatic checks
        </Text>
      </Group>
      <DataTable
        columns={[
          {
            key: "generic_name",
            label: "Generic",
            render: (d) => (
              <Stack gap={0}>
                <Group gap={6}>
                  <Text size="sm" fw={600} tt="capitalize">
                    {d.generic_name}
                  </Text>
                  {d.is_nlem ? (
                    <Badge tone="success" size="xs">
                      NLEM
                    </Badge>
                  ) : null}
                </Group>
                {d.brands ? (
                  <Text size="xs" c="dimmed">
                    {d.brands}
                  </Text>
                ) : null}
              </Stack>
            ),
          },
          {
            key: "max_dose_per_day",
            label: "Max/day",
            render: (d) => <Text size="sm">{d.max_dose_per_day ?? "—"}</Text>,
          },
          {
            key: "dose_per_kg",
            label: "Paeds mg/kg",
            render: (d) => <Text size="sm">{d.dose_per_kg ?? "—"}</Text>,
          },
          {
            key: "renal",
            label: "Renal",
            render: (d) =>
              d.renal_adjust_rule ? (
                <Text size="xs" lineClamp={2} maw={220}>
                  {d.renal_adjust_egfr_threshold ? `eGFR<${d.renal_adjust_egfr_threshold}: ` : ""}
                  {d.renal_adjust_rule}
                </Text>
              ) : (
                <Text size="sm" c="dimmed">
                  —
                </Text>
              ),
          },
          {
            key: "hepatic_caution",
            label: "Hepatic",
            render: (d) =>
              d.hepatic_caution ? (
                <Text size="xs" lineClamp={2} maw={220}>
                  {d.hepatic_caution}
                </Text>
              ) : (
                <Text size="sm" c="dimmed">
                  —
                </Text>
              ),
          },
          {
            key: "pregnancy_category",
            label: "Preg",
            render: (d) =>
              d.pregnancy_category ? (
                <Badge tone={["D", "X"].includes(d.pregnancy_category) ? "danger" : "neutral"}>
                  {d.pregnancy_category}
                </Badge>
              ) : (
                <Text size="sm" c="dimmed">
                  —
                </Text>
              ),
          },
        ]}
        data={drugs}
        loading={isLoading}
        rowKey={(d) => d.generic_name}
      />
    </Stack>
  );
}
