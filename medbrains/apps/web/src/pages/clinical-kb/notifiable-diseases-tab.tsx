// Clinical-kb NotifiableDiseasesTab — split from clinical-kb.tsx (pure move).

import { Group, Stack, Text } from "@mantine/core";
import { IconAlertTriangle } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import { Badge, Input, Switch } from "@/components/ui";
import { ckbService } from "@/services/ckb.service";

export function NotifiableDiseasesTab() {
  const [search, setSearch] = useState("");
  const [notifiableOnly, setNotifiableOnly] = useState(true);

  const { data: diagnoses = [], isLoading } = useQuery({
    queryKey: ["ckb-diagnoses", search, notifiableOnly],
    queryFn: () =>
      ckbService.listCkbDiagnoses({ q: search.trim(), notifiable_only: notifiableOnly }),
  });

  return (
    <Stack>
      <Group justify="space-between" wrap="nowrap">
        <Input
          placeholder="Search diagnosis or ICD-10 code"
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          w={320}
        />
        <Switch
          label="Notifiable only"
          checked={notifiableOnly}
          onChange={(e) => setNotifiableOnly(e.currentTarget.checked)}
        />
      </Group>
      <DataTable
        columns={[
          {
            key: "icd10_code",
            label: "ICD-10",
            render: (d) => (
              <Text size="sm" ff="var(--mb-font-mono)">
                {d.icd10_code}
              </Text>
            ),
          },
          { key: "name", label: "Diagnosis", render: (d) => <Text size="sm">{d.name}</Text> },
          {
            key: "department",
            label: "Department",
            render: (d) => (
              <Text size="sm" c="dimmed">
                {d.department ?? "—"}
              </Text>
            ),
          },
          {
            key: "notifiable",
            label: "Notifiable",
            render: (d) =>
              d.is_notifiable ? (
                <Badge tone="danger" leftSection={<IconAlertTriangle size={11} />}>
                  {d.reporting_body ?? "Notifiable"}
                  {d.report_timeframe ? ` · ${d.report_timeframe}` : ""}
                </Badge>
              ) : (
                <Text size="sm" c="dimmed">
                  —
                </Text>
              ),
          },
        ]}
        data={diagnoses}
        loading={isLoading}
        rowKey={(d) => d.icd10_code}
      />
    </Stack>
  );
}
