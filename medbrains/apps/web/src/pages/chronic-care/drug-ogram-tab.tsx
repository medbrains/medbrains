// Chronic-care DrugOgramTab — split from chronic-care.tsx (pure move).

import { LineChart } from "@mantine/charts";
import { Card, Group, Paper, Select, Stack, Text, Tooltip } from "@mantine/core";
import type { DrugTimelineWithLabsResponse, MedicationTimelineEvent } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Badge, type BadgeTone } from "@/components/ui";
import { chronicCareService } from "@/services/chronicCare.service";

const EVENT_COLORS: Record<string, BadgeTone> = {
  started: "success",
  dose_changed: "primary",
  switched: "accent",
  discontinued: "danger",
  resumed: "success",
  held: "warning",
};

export function DrugOgramTab() {
  const { data: enrollments = [] } = useQuery({
    queryKey: ["chronic-enrollments-all-drugogram"],
    queryFn: () => chronicCareService.listChronicEnrollments({ status: "active" }),
  });

  const [selectedPatient, setSelectedPatient] = useState<string | null>(null);

  const { data: timeline, isLoading } = useQuery({
    queryKey: ["drug-timeline-labs", selectedPatient],
    queryFn: () => chronicCareService.drugTimelineWithLabs(selectedPatient ?? ""),
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
      <Select
        label="Select Patient"
        placeholder="Choose an enrolled patient"
        data={patientOptions}
        value={selectedPatient}
        onChange={setSelectedPatient}
        searchable
      />

      {isLoading && <Text c="dimmed">Loading timeline...</Text>}
      {timeline && <DrugOgramView data={timeline} />}
    </Stack>
  );
}

function DrugOgramView({ data }: { data: DrugTimelineWithLabsResponse }) {
  // Group medication events by drug
  const drugGroups = useMemo(() => {
    const groups: Record<string, MedicationTimelineEvent[]> = {};
    for (const ev of data.medication_events) {
      const key = ev.drug_name;
      if (!groups[key]) groups[key] = [];
      groups[key].push(ev);
    }
    return Object.entries(groups);
  }, [data.medication_events]);

  // Lab chart data
  const labCharts = useMemo(() => {
    return data.lab_series
      .filter((s) => s.data_points.length > 0)
      .map((series) => ({
        name: series.parameter_name,
        unit: series.unit,
        targetValue: series.target_value,
        data: series.data_points.map((p) => ({
          date: new Date(p.result_date).toLocaleDateString(),
          value: p.numeric_value ?? 0,
        })),
      }));
  }, [data.lab_series]);

  // Vitals chart data (group by parameter)
  const vitalGroups = useMemo(() => {
    const groups: Record<string, { date: string; value: number }[]> = {};
    for (const v of data.vitals_series) {
      if (v.numeric_value === null) continue;
      if (!groups[v.parameter]) {
        groups[v.parameter] = [];
      }
      const arr = groups[v.parameter] ?? [];
      groups[v.parameter] = arr;
      arr.push({
        date: new Date(v.recorded_at).toLocaleDateString(),
        value: v.numeric_value,
      });
    }
    return Object.entries(groups);
  }, [data.vitals_series]);

  return (
    <Stack gap="lg">
      {/* Active Drugs Legend */}
      {data.active_drugs.length > 0 && (
        <Card withBorder padding="sm">
          <Text fw={500} size="sm" mb="xs">
            Active Medications
          </Text>
          <Group gap="xs">
            {data.active_drugs.map((d) => (
              <Badge key={d.drug_name} tone="primary" variant="light" size="sm">
                {d.drug_name} {d.dosage ? `(${d.dosage})` : ""}
              </Badge>
            ))}
          </Group>
        </Card>
      )}

      {/* Medication Timeline */}
      {drugGroups.length > 0 && (
        <Card withBorder padding="md">
          <Text fw={500} mb="sm">
            Medication Timeline
          </Text>
          <Stack gap="sm">
            {drugGroups.map(([drugName, events]) => (
              <Paper key={drugName} withBorder p="xs">
                <Text size="sm" fw={500} mb={4}>
                  {drugName}
                </Text>
                <Group gap={4} wrap="wrap">
                  {events.map((ev) => (
                    <Tooltip
                      key={ev.id}
                      label={`${ev.event_type}: ${ev.dosage ?? ""} ${ev.frequency ?? ""} (${new Date(ev.effective_date).toLocaleDateString()})${ev.change_reason ? ` — ${ev.change_reason}` : ""}`}
                    >
                      <Badge
                        tone={EVENT_COLORS[ev.event_type] ?? "neutral"}
                        variant="filled"
                        size="xs"
                        style={{ cursor: "pointer" }}
                      >
                        {ev.event_type} {new Date(ev.effective_date).toLocaleDateString()}
                      </Badge>
                    </Tooltip>
                  ))}
                </Group>
              </Paper>
            ))}
          </Stack>
        </Card>
      )}

      {/* Lab Overlay Charts */}
      {labCharts.map((chart) => (
        <Card key={chart.name} withBorder padding="md">
          <Text fw={500} size="sm" mb="xs">
            {chart.name} {chart.unit ? `(${chart.unit})` : ""}
            {chart.targetValue !== null && (
              <Text span c="dimmed" size="xs">
                {" "}
                — Target: {chart.targetValue}
              </Text>
            )}
          </Text>
          <LineChart
            h={180}
            data={chart.data}
            dataKey="date"
            series={[{ name: "value", color: "primary" }]}
            curveType="monotone"
            referenceLines={
              chart.targetValue !== null
                ? [{ y: chart.targetValue, color: "red.5", label: "Target" }]
                : undefined
            }
          />
        </Card>
      ))}

      {/* Vitals Mini Charts */}
      {vitalGroups.map(([param, points]) => (
        <Card key={param} withBorder padding="md">
          <Text fw={500} size="sm" mb="xs">
            {param}
          </Text>
          <LineChart
            h={150}
            data={points}
            dataKey="date"
            series={[{ name: "value", color: "teal" }]}
            curveType="monotone"
          />
        </Card>
      ))}

      {drugGroups.length === 0 && data.lab_series.length === 0 && (
        <Text c="dimmed" ta="center">
          No timeline data available for this patient.
        </Text>
      )}
    </Stack>
  );
}
