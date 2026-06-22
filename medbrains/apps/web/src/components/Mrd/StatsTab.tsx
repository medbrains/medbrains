import { Card, Group, SimpleGrid, Stack, Text } from "@mantine/core";
import { DateInput } from "@mantine/dates";
import type { MrdAdmissionDischargeSummary, MrdMorbidityMortalityResponse } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import { Badge } from "@/components/ui";
import { mrdService } from "@/services/mrd.service";

export function StatsTab() {
  const [fromDate, setFromDate] = useState<string | null>(null);
  const [toDate, setToDate] = useState<string | null>(null);

  const dateParams = {
    from_date: fromDate?.slice(0, 10) ?? undefined,
    to_date: toDate?.slice(0, 10) ?? undefined,
  };

  const { data: morbMort } = useQuery({
    queryKey: ["mrd-morbidity-mortality", dateParams],
    queryFn: () => mrdService.getMrdMorbidityMortality(dateParams),
  });

  const { data: admDisch } = useQuery({
    queryKey: ["mrd-admission-discharge", dateParams],
    queryFn: () => mrdService.getMrdAdmissionDischarge(dateParams),
  });

  return (
    <Stack>
      <Group>
        <DateInput label="From" value={fromDate} onChange={setFromDate} clearable />
        <DateInput label="To" value={toDate} onChange={setToDate} clearable />
      </Group>

      {/* Summary Cards */}
      {admDisch && (
        <SimpleGrid cols={{ base: 2, md: 4 }}>
          <Card withBorder>
            <Text size="sm" c="dimmed">
              Admitted
            </Text>
            <Text size="xl" fw={700}>
              {admDisch.total_admitted}
            </Text>
          </Card>
          <Card withBorder>
            <Text size="sm" c="dimmed">
              Discharged
            </Text>
            <Text size="xl" fw={700}>
              {admDisch.total_discharged}
            </Text>
          </Card>
          <Card withBorder>
            <Text size="sm" c="dimmed">
              Deaths
            </Text>
            <Text size="xl" fw={700} c="danger">
              {admDisch.total_deaths}
            </Text>
          </Card>
          <Card withBorder>
            <Text size="sm" c="dimmed">
              Avg LOS (days)
            </Text>
            <Text size="xl" fw={700}>
              {admDisch.overall_avg_los_days?.toFixed(1) ?? "—"}
            </Text>
          </Card>
        </SimpleGrid>
      )}

      {/* Morbidity */}
      <Text fw={600} mt="md">
        Top Morbidity (by ICD-11)
      </Text>
      <DataTable
        columns={[
          {
            key: "icd_code",
            label: "ICD-11 Code",
            render: (r: NonNullable<MrdMorbidityMortalityResponse>["morbidity"][number]) => (
              <Text>{r.icd_code ?? "—"}</Text>
            ),
          },
          {
            key: "diagnosis_name",
            label: "Diagnosis",
            render: (r: NonNullable<MrdMorbidityMortalityResponse>["morbidity"][number]) => (
              <Text>{r.diagnosis_name}</Text>
            ),
          },
          {
            key: "count",
            label: "Cases",
            render: (r: NonNullable<MrdMorbidityMortalityResponse>["morbidity"][number]) => (
              <Text fw={600}>{r.count}</Text>
            ),
          },
        ]}
        data={morbMort?.morbidity ?? []}
        loading={false}
        rowKey={(r) => `${r.icd_code}-${r.diagnosis_name}`}
      />

      {/* Mortality */}
      <Text fw={600} mt="md">
        Top Mortality Causes
      </Text>
      <DataTable
        columns={[
          {
            key: "cause_of_death",
            label: "Cause",
            render: (r: NonNullable<MrdMorbidityMortalityResponse>["mortality"][number]) => (
              <Text>{r.cause_of_death ?? "Unknown"}</Text>
            ),
          },
          {
            key: "manner_of_death",
            label: "Manner",
            render: (r: NonNullable<MrdMorbidityMortalityResponse>["mortality"][number]) => (
              <Badge tone="neutral">{r.manner_of_death}</Badge>
            ),
          },
          {
            key: "count",
            label: "Deaths",
            render: (r: NonNullable<MrdMorbidityMortalityResponse>["mortality"][number]) => (
              <Text fw={600} c="danger">
                {r.count}
              </Text>
            ),
          },
        ]}
        data={morbMort?.mortality ?? []}
        loading={false}
        rowKey={(r) => `${r.cause_of_death}-${r.manner_of_death}`}
      />

      {/* Department-wise Admission/Discharge */}
      <Text fw={600} mt="md">
        Admission/Discharge by Department
      </Text>
      <DataTable
        columns={[
          {
            key: "department_name",
            label: "Department",
            render: (r: NonNullable<MrdAdmissionDischargeSummary>["rows"][number]) => (
              <Text>{r.department_name ?? "Unknown"}</Text>
            ),
          },
          {
            key: "total_admitted",
            label: "Admitted",
            render: (r: NonNullable<MrdAdmissionDischargeSummary>["rows"][number]) => (
              <Text>{r.total_admitted}</Text>
            ),
          },
          {
            key: "total_discharged",
            label: "Discharged",
            render: (r: NonNullable<MrdAdmissionDischargeSummary>["rows"][number]) => (
              <Text>{r.total_discharged}</Text>
            ),
          },
          {
            key: "total_deaths",
            label: "Deaths",
            render: (r: NonNullable<MrdAdmissionDischargeSummary>["rows"][number]) => (
              <Text c="danger">{r.total_deaths}</Text>
            ),
          },
          {
            key: "avg_los_days",
            label: "Avg LOS",
            render: (r: NonNullable<MrdAdmissionDischargeSummary>["rows"][number]) => (
              <Text>{r.avg_los_days?.toFixed(1) ?? "—"}</Text>
            ),
          },
        ]}
        data={admDisch?.rows ?? []}
        loading={false}
        rowKey={(r) => r.department_name ?? "unknown"}
      />
    </Stack>
  );
}
