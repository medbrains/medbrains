// Chronic-care AdherenceTab — split from chronic-care.tsx (pure move).

import { Card, Group, Progress, Select, SimpleGrid, Stack, Text } from "@mantine/core";
import type { AdherenceSummaryResponse } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Badge } from "@/components/ui";
import { chronicCareService } from "@/services/chronicCare.service";

export function AdherenceTab() {
  const { data: enrollments = [] } = useQuery({
    queryKey: ["chronic-enrollments-active"],
    queryFn: () => chronicCareService.listChronicEnrollments({ status: "active" }),
  });

  const [selectedEnrollment, setSelectedEnrollment] = useState<string | null>(null);

  const { data: summary } = useQuery({
    queryKey: ["adherence-summary", selectedEnrollment],
    queryFn: () => chronicCareService.adherenceSummary(selectedEnrollment ?? ""),
    enabled: !!selectedEnrollment,
  });

  return (
    <Stack gap="md">
      <Select
        label="Select Enrollment"
        placeholder="Choose an active enrollment"
        data={enrollments.map((e) => ({
          value: e.id,
          label: `${e.patient_name} — ${e.program_name} (${e.uhid})`,
        }))}
        value={selectedEnrollment}
        onChange={setSelectedEnrollment}
        searchable
      />

      {summary && <AdherenceSummaryCards summary={summary} />}
    </Stack>
  );
}

function AdherenceSummaryCards({ summary }: { summary: AdherenceSummaryResponse }) {
  const totalDoses = summary.doses_taken + summary.doses_missed + summary.doses_late;

  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }}>
        <Card withBorder padding="md">
          <Text size="xs" c="dimmed" tt="uppercase">
            Dose Adherence
          </Text>
          <Text fw={700} size="xl">
            {totalDoses > 0 ? `${Math.round(Number(summary.dose_adherence_pct))}%` : "N/A"}
          </Text>
          <Progress
            value={totalDoses > 0 ? Number(summary.dose_adherence_pct) : 0}
            color={Number(summary.dose_adherence_pct) >= 80 ? "success" : "danger"}
            mt="xs"
          />
        </Card>
        <Card withBorder padding="md">
          <Text size="xs" c="dimmed" tt="uppercase">
            Doses
          </Text>
          <Group gap="xs" mt="xs">
            <Badge tone="success" variant="light">
              {summary.doses_taken} taken
            </Badge>
            <Badge tone="danger" variant="light">
              {summary.doses_missed} missed
            </Badge>
            <Badge tone="warning" variant="light">
              {summary.doses_late} late
            </Badge>
          </Group>
        </Card>
        <Card withBorder padding="md">
          <Text size="xs" c="dimmed" tt="uppercase">
            Refills
          </Text>
          <Group gap="xs" mt="xs">
            <Badge tone="success" variant="light">
              {summary.refills_on_time} on time
            </Badge>
            <Badge tone="warning" variant="light">
              {summary.refills_late} late
            </Badge>
            <Badge tone="danger" variant="light">
              {summary.refills_missed} missed
            </Badge>
          </Group>
        </Card>
        <Card withBorder padding="md">
          <Text size="xs" c="dimmed" tt="uppercase">
            Appointments
          </Text>
          <Group gap="xs" mt="xs">
            <Badge tone="success" variant="light">
              {summary.appointments_attended} attended
            </Badge>
            <Badge tone="danger" variant="light">
              {summary.appointments_missed} missed
            </Badge>
          </Group>
        </Card>
      </SimpleGrid>

      {summary.by_month.length > 0 && (
        <Card withBorder padding="md">
          <Text fw={500} mb="sm">
            Monthly Dose Adherence
          </Text>
          {summary.by_month.map((m) => {
            const total = m.taken + m.missed + m.late;
            const pct = total > 0 ? Math.round((m.taken / total) * 100) : 0;
            return (
              <Group key={m.month} mb="xs">
                <Text size="sm" w={80}>
                  {m.month}
                </Text>
                <Progress
                  value={pct}
                  color={pct >= 80 ? "success" : "danger"}
                  style={{ flex: 1 }}
                />
                <Text size="sm" w={40}>
                  {pct}%
                </Text>
              </Group>
            );
          })}
        </Card>
      )}
    </Stack>
  );
}
