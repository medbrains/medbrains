// Chronic-care OutcomesTab — split from chronic-care.tsx (pure move).

import { Card, Group, Progress, Select, SimpleGrid, Stack, Text } from "@mantine/core";
import type { OutcomeDashboardResponse, OutcomeTargetWithActual } from "@medbrains/types";
import { IconArrowDown, IconArrowUp, IconMinus } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui";
import { chronicCareService } from "@/services/chronicCare.service";
import { PROGRAM_TYPES } from "./shared";

export function OutcomesTab() {
  const { data: enrollments = [] } = useQuery({
    queryKey: ["chronic-enrollments-active-outcomes"],
    queryFn: () => chronicCareService.listChronicEnrollments({ status: "active" }),
  });

  const [selectedPatient, setSelectedPatient] = useState<string | null>(null);

  const { data: dashboard } = useQuery({
    queryKey: ["outcome-dashboard", selectedPatient],
    queryFn: () => chronicCareService.outcomeDashboard(selectedPatient ?? ""),
    enabled: !!selectedPatient,
  });

  const totalEnrolled = enrollments.length;
  const byType = enrollments.reduce<Record<string, number>>((acc, e) => {
    acc[e.program_type] = (acc[e.program_type] ?? 0) + 1;
    return acc;
  }, {});

  const patientOptions = useMemo(() => {
    const seen = new Set<string>();
    return enrollments
      .filter((e) => {
        if (seen.has(e.patient_id)) return false;
        seen.add(e.patient_id);
        return true;
      })
      .map((e) => ({ value: e.patient_id, label: `${e.patient_name} (${e.uhid})` }));
  }, [enrollments]);

  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        <Card withBorder padding="md">
          <Text size="xs" c="dimmed" tt="uppercase">
            Total Active Enrollments
          </Text>
          <Text fw={700} size="xl">
            {totalEnrolled}
          </Text>
        </Card>
        <Card withBorder padding="md">
          <Text size="xs" c="dimmed" tt="uppercase">
            Programs with Enrollments
          </Text>
          <Text fw={700} size="xl">
            {Object.keys(byType).length}
          </Text>
        </Card>
        <Card withBorder padding="md">
          <Text size="xs" c="dimmed" tt="uppercase">
            Breakdown by Type
          </Text>
          <Stack gap={4} mt="xs">
            {Object.entries(byType).map(([type, count]) => (
              <Group key={type} justify="space-between">
                <Text size="sm">{PROGRAM_TYPES.find((t) => t.value === type)?.label ?? type}</Text>
                <Badge tone="neutral" variant="light">
                  {count}
                </Badge>
              </Group>
            ))}
          </Stack>
        </Card>
      </SimpleGrid>

      <Select
        label="Patient Outcome Detail"
        placeholder="Select a patient to view targets"
        data={patientOptions}
        value={selectedPatient}
        onChange={setSelectedPatient}
        searchable
      />

      {dashboard && <OutcomeDetailCards dashboard={dashboard} />}
    </Stack>
  );
}

function TrendArrow({ atTarget }: { atTarget: boolean | null }) {
  if (atTarget === null) return <IconMinus size={14} color="slate" />;
  return atTarget ? (
    <IconArrowUp size={14} color="success" />
  ) : (
    <IconArrowDown size={14} color="danger" />
  );
}

function OutcomeDetailCards({ dashboard }: { dashboard: OutcomeDashboardResponse }) {
  return (
    <Stack gap="md">
      {dashboard.adherence_rate !== null && (
        <Card withBorder padding="md">
          <Text size="xs" c="dimmed" tt="uppercase">
            Overall Adherence
          </Text>
          <Progress
            value={dashboard.adherence_rate}
            color={dashboard.adherence_rate >= 80 ? "success" : "danger"}
            mt="xs"
          />
          <Text size="sm" mt={4}>
            {Math.round(dashboard.adherence_rate)}%
          </Text>
        </Card>
      )}
      <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
        {dashboard.targets.map((t: OutcomeTargetWithActual) => (
          <Card key={t.target.id} withBorder padding="md">
            <Group justify="space-between" mb="xs">
              <Text size="sm" fw={500}>
                {t.target.parameter_name}
              </Text>
              <TrendArrow atTarget={t.at_target} />
            </Group>
            <Group gap="xs">
              <Text size="xs" c="dimmed">
                Target: {t.target.comparison} {t.target.target_value} {t.target.unit}
              </Text>
            </Group>
            <Group gap="xs" mt={4}>
              <Text size="sm">
                Actual: {t.latest_value !== null ? `${t.latest_value} ${t.target.unit}` : "—"}
              </Text>
              <Badge
                tone={t.at_target ? "success" : t.at_target === false ? "danger" : "neutral"}
                size="xs"
              >
                {t.at_target ? "At target" : t.at_target === false ? "Off target" : "No data"}
              </Badge>
            </Group>
            {t.latest_date && (
              <Text size="xs" c="dimmed" mt={4}>
                Last: {new Date(t.latest_date).toLocaleDateString()}
              </Text>
            )}
          </Card>
        ))}
      </SimpleGrid>
    </Stack>
  );
}
