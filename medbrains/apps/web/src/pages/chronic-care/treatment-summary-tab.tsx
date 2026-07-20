// Chronic-care TreatmentSummaryTab — split from chronic-care.tsx (pure move).

import { LineChart } from "@mantine/charts";
import { Card, Group, Paper, Progress, Select, SimpleGrid, Stack, Text } from "@mantine/core";
import type { TreatmentSummaryResponse } from "@medbrains/types";
import { IconPrinter } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Badge, Button } from "@/components/ui";
import { chronicCareService } from "@/services/chronicCare.service";
import { STATUS_COLORS } from "./shared";

export function TreatmentSummaryTab() {
  const { data: enrollments = [] } = useQuery({
    queryKey: ["chronic-enrollments-all-summary"],
    queryFn: () => chronicCareService.listChronicEnrollments({ status: "active" }),
  });

  const [selectedPatient, setSelectedPatient] = useState<string | null>(null);

  const { data: summary, isLoading } = useQuery({
    queryKey: ["treatment-summary", selectedPatient],
    queryFn: () => chronicCareService.treatmentSummary(selectedPatient ?? ""),
    enabled: !!selectedPatient,
  });

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
      <Group>
        <Select
          label="Select Patient"
          placeholder="Choose a patient"
          data={patientOptions}
          value={selectedPatient}
          onChange={setSelectedPatient}
          searchable
          style={{ flex: 1 }}
        />
        {summary && (
          <Button
            tone="secondary"
            leftSection={<IconPrinter size={14} />}
            mt={24}
            onClick={() => window.print()}
          >
            Print Summary
          </Button>
        )}
      </Group>

      {isLoading && <Text c="dimmed">Loading summary...</Text>}
      {summary && <TreatmentSummaryView summary={summary} />}
    </Stack>
  );
}

function TreatmentSummaryView({ summary }: { summary: TreatmentSummaryResponse }) {
  return (
    <Stack gap="md" className="print-area">
      {/* Patient Demographics */}
      <Card withBorder padding="md">
        <Text fw={600} size="lg">
          {summary.patient_name}
        </Text>
        <Group gap="md" mt={4}>
          <Text size="sm" c="dimmed">
            UHID: {summary.uhid}
          </Text>
          {summary.date_of_birth && (
            <Text size="sm" c="dimmed">
              DOB: {summary.date_of_birth}
            </Text>
          )}
          {summary.gender && (
            <Text size="sm" c="dimmed">
              Gender: {summary.gender}
            </Text>
          )}
        </Group>
      </Card>

      {/* Active Diagnoses */}
      {summary.active_diagnoses.length > 0 && (
        <Card withBorder padding="md">
          <Text fw={500} mb="xs">
            Active Diagnoses
          </Text>
          <Stack gap={4}>
            {summary.active_diagnoses.map((d) => (
              <Group key={`${d.diagnosis_name}-${d.icd_code ?? "uncoded"}`} gap="xs">
                <Text size="sm">{d.diagnosis_name}</Text>
                {d.icd_code && (
                  <Badge tone="neutral" variant="light" size="xs">
                    {d.icd_code}
                  </Badge>
                )}
              </Group>
            ))}
          </Stack>
        </Card>
      )}

      {/* Current Medications */}
      {summary.current_medications.length > 0 && (
        <Card withBorder padding="md">
          <Text fw={500} mb="xs">
            Current Medications
          </Text>
          <Stack gap={4}>
            {summary.current_medications.map((m) => (
              <Group key={m.drug_name} gap="xs">
                <Text size="sm" fw={500}>
                  {m.drug_name}
                </Text>
                {m.generic_name && (
                  <Text size="xs" c="dimmed">
                    ({m.generic_name})
                  </Text>
                )}
                <Text size="sm">
                  {m.dosage} {m.frequency} {m.route}
                </Text>
              </Group>
            ))}
          </Stack>
        </Card>
      )}

      {/* Outcome Targets */}
      {summary.targets.length > 0 && (
        <Card withBorder padding="md">
          <Text fw={500} mb="xs">
            Outcome Targets
          </Text>
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
            {summary.targets.map((t) => (
              <Paper key={t.target.id} withBorder p="xs">
                <Group justify="space-between">
                  <Text size="sm" fw={500}>
                    {t.target.parameter_name}
                  </Text>
                  <Badge
                    tone={t.at_target ? "success" : t.at_target === false ? "danger" : "neutral"}
                    size="xs"
                  >
                    {t.at_target ? "At target" : t.at_target === false ? "Off target" : "No data"}
                  </Badge>
                </Group>
                <Text size="xs" c="dimmed">
                  Target: {t.target.comparison} {t.target.target_value} {t.target.unit}
                  {t.latest_value !== null && ` | Actual: ${t.latest_value}`}
                </Text>
              </Paper>
            ))}
          </SimpleGrid>
        </Card>
      )}

      {/* Lab Trend Sparklines */}
      {summary.lab_trends.length > 0 && (
        <Card withBorder padding="md">
          <Text fw={500} mb="xs">
            Lab Trends
          </Text>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            {summary.lab_trends
              .filter((s) => s.data_points.length > 0)
              .map((series) => (
                <Paper key={series.parameter_name} withBorder p="xs">
                  <Text size="sm" fw={500} mb={4}>
                    {series.parameter_name} {series.unit ? `(${series.unit})` : ""}
                  </Text>
                  <LineChart
                    h={100}
                    data={series.data_points.map((p) => ({
                      date: new Date(p.result_date).toLocaleDateString(),
                      value: p.numeric_value ?? 0,
                    }))}
                    dataKey="date"
                    series={[{ name: "value", color: "primary" }]}
                    curveType="monotone"
                    withDots={false}
                    referenceLines={
                      series.target_value !== null
                        ? [{ y: series.target_value, color: "red.5", label: "Target" }]
                        : undefined
                    }
                  />
                </Paper>
              ))}
          </SimpleGrid>
        </Card>
      )}

      {/* Adherence Rate */}
      {summary.adherence_rate !== null && (
        <Card withBorder padding="md">
          <Text fw={500} mb="xs">
            Overall Adherence Rate
          </Text>
          <Progress
            value={summary.adherence_rate}
            color={summary.adherence_rate >= 80 ? "success" : "danger"}
            size="lg"
          />
          <Text size="sm" mt={4}>
            {Math.round(summary.adherence_rate)}%
          </Text>
        </Card>
      )}

      {/* Enrollment History */}
      {summary.enrollments.length > 0 && (
        <Card withBorder padding="md">
          <Text fw={500} mb="xs">
            Enrollment History
          </Text>
          <Stack gap={4}>
            {summary.enrollments.map((e) => (
              <Group key={`${e.program_name}-${e.enrollment_date}-${e.status}`} gap="xs">
                <Text size="sm">{e.program_name}</Text>
                <Text size="xs" c="dimmed">
                  Enrolled: {e.enrollment_date}
                </Text>
                <Badge tone={STATUS_COLORS[e.status] ?? "neutral"} size="xs">
                  {e.status.replace(/_/g, " ")}
                </Badge>
              </Group>
            ))}
          </Stack>
        </Card>
      )}
    </Stack>
  );
}
