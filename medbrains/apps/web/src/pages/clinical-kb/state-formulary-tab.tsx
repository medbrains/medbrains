// Clinical-kb StateFormularyTab — split from clinical-kb.tsx (pure move).

import { Group, Stack, Text } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import type { BadgeTone } from "@/components/ui";
import { Alert, Badge, Select } from "@/components/ui";
import { ckbService } from "@/services/ckb.service";

export function StateFormularyTab() {
  const { data: schemes = [] } = useQuery({
    queryKey: ["ckb-state-schemes"],
    queryFn: () => ckbService.listCkbStateSchemes(),
    staleTime: 600_000,
  });
  const [stateCode, setStateCode] = useState<string | null>(null);
  const active = stateCode ?? schemes[0]?.state_code ?? null;
  const activeScheme = schemes.find((s) => s.state_code === active);

  const { data: drugs = [], isLoading } = useQuery({
    queryKey: ["ckb-state-formulary", active],
    queryFn: () => ckbService.listCkbStateFormulary(active ?? ""),
    enabled: Boolean(active),
    staleTime: 600_000,
  });

  const coverageTone = (c: string): BadgeTone => (c === "free" ? "success" : "warning");

  return (
    <Stack>
      <Group justify="space-between" align="flex-end">
        <Select
          label="State scheme"
          placeholder="Select a state"
          data={schemes.map((s) => ({
            value: s.state_code,
            label: `${s.state_name} — ${s.scheme_name}`,
          }))}
          value={active}
          onChange={setStateCode}
          searchable
          w={420}
        />
        {activeScheme ? (
          <Text size="xs" c="dimmed">
            {activeScheme.drug_count} essential generics · {activeScheme.coverage}
          </Text>
        ) : null}
      </Group>
      {activeScheme ? (
        <Alert tone={activeScheme.coverage === "free" ? "success" : "warning"}>
          Under <strong>{activeScheme.scheme_name}</strong> ({activeScheme.state_name}), these
          essential generics are {activeScheme.coverage === "free" ? "supplied free" : "subsidised"}{" "}
          in government facilities — prefer them to reduce patient cost.
        </Alert>
      ) : null}
      <DataTable
        columns={[
          {
            key: "generic_name",
            label: "Generic",
            render: (d) => (
              <Text size="sm" fw={600} tt="capitalize">
                {d.generic_name}
              </Text>
            ),
          },
          {
            key: "coverage",
            label: "Coverage",
            render: (d) => <Badge tone={coverageTone(d.coverage)}>{d.coverage}</Badge>,
          },
          {
            key: "scheme_name",
            label: "Scheme",
            render: (d) => (
              <Text size="sm" c="dimmed">
                {d.scheme_name}
              </Text>
            ),
          },
        ]}
        data={drugs}
        loading={isLoading}
        rowKey={(d) => `${active}-${d.generic_name}`}
      />
    </Stack>
  );
}
