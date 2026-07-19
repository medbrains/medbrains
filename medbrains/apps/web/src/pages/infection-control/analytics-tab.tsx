// IPD AnalyticsTab — split from infection-control.tsx (pure move).

import { BarChart, LineChart } from "@mantine/charts";
import { Group, Paper, SegmentedControl, Stack, Text, Title, Tooltip } from "@mantine/core";
import { DateInput } from "@mantine/dates";
import type {
  AntimicrobialConsumptionRow,
  CultureSensitivityRow,
  DeviceUtilizationRow,
  SurgicalProphylaxisRow,
} from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { DataTable } from "@/components";
import { Badge, Table } from "@/components/ui";
import { infectionControlService } from "@/services/infectionControl.service";

export function AnalyticsTab() {
  const [subView, setSubView] = useState<string>("hai-rates");
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const dateParams = {
    from: from ? from.slice(0, 10) : undefined,
    to: to ? to.slice(0, 10) : undefined,
  };

  const { data: haiRates = [], isLoading: haiLoading } = useQuery({
    queryKey: ["ic-hai-rates", dateParams],
    queryFn: () => infectionControlService.icHaiRates(dateParams),
    enabled: subView === "hai-rates",
  });

  const { data: deviceUtil = [], isLoading: deviceLoading } = useQuery({
    queryKey: ["ic-device-util", dateParams],
    queryFn: () => infectionControlService.icDeviceUtilization(dateParams),
    enabled: subView === "device-util",
  });

  const { data: amConsumption = [], isLoading: amLoading } = useQuery({
    queryKey: ["ic-am-consumption", dateParams],
    queryFn: () => infectionControlService.icAntimicrobialConsumption(dateParams),
    enabled: subView === "am-consumption",
  });

  const { data: prophylaxis = [], isLoading: prophLoading } = useQuery({
    queryKey: ["ic-prophylaxis", dateParams],
    queryFn: () => infectionControlService.icSurgicalProphylaxis(dateParams),
    enabled: subView === "prophylaxis",
  });

  const { data: cultureSens = [], isLoading: csLoading } = useQuery({
    queryKey: ["ic-culture-sens", dateParams],
    queryFn: () => infectionControlService.icCultureSensitivityReport(dateParams),
    enabled: subView === "culture-sens",
  });

  const { data: mdro = [], isLoading: mdroLoading } = useQuery({
    queryKey: ["ic-mdro", dateParams],
    queryFn: () => infectionControlService.icMdroTracking(dateParams),
    enabled: subView === "mdro",
  });

  // Build culture sensitivity matrix: rows = organisms, columns = antibiotics
  const csMatrix = useMemo(() => {
    const orgMap: Record<string, Record<string, CultureSensitivityRow>> = {};
    const antibiotics = new Set<string>();
    cultureSens.forEach((r) => {
      if (!orgMap[r.organism]) orgMap[r.organism] = {};
      const orgEntry = orgMap[r.organism];
      if (orgEntry) {
        orgEntry[r.antibiotic] = r;
      }
      antibiotics.add(r.antibiotic);
    });
    return { orgMap, antibiotics: Array.from(antibiotics).sort() };
  }, [cultureSens]);

  // Build MDRO line chart data: x = month, series per organism
  const mdroChartData = useMemo(() => {
    const months = [...new Set(mdro.map((r) => r.month))].sort();
    const organisms = [...new Set(mdro.map((r) => r.organism))];
    return months.map((m) => {
      const point: Record<string, string | number> = { month: m };
      organisms.forEach((org) => {
        const row = mdro.find((r) => r.month === m && r.organism === org);
        point[org] = row ? row.rate_per_1000 : 0;
      });
      return point;
    });
  }, [mdro]);

  const mdroSeries = useMemo(() => {
    const organisms = [...new Set(mdro.map((r) => r.organism))];
    const colors = ["red", "orange", "violet", "blue", "teal", "grape", "cyan", "pink"];
    return organisms.map((org, i) => ({
      name: org,
      color: colors[i % colors.length],
    }));
  }, [mdro]);

  const deviceUtilColumns = [
    { key: "unit_name" as const, label: "Unit", render: (r: DeviceUtilizationRow) => r.unit_name },
    {
      key: "device_type" as const,
      label: "Device",
      render: (r: DeviceUtilizationRow) => r.device_type,
    },
    {
      key: "device_days" as const,
      label: "Device Days",
      render: (r: DeviceUtilizationRow) => String(r.device_days),
    },
    {
      key: "patient_days" as const,
      label: "Patient Days",
      render: (r: DeviceUtilizationRow) => String(r.patient_days),
    },
    {
      key: "utilization_ratio" as const,
      label: "Utilization Ratio",
      render: (r: DeviceUtilizationRow) => r.utilization_ratio.toFixed(3),
    },
  ];

  const amColumns = [
    {
      key: "drug_name" as const,
      label: "Drug",
      render: (r: AntimicrobialConsumptionRow) => <Text fw={500}>{r.drug_name}</Text>,
    },
    {
      key: "atc_code" as const,
      label: "ATC Code",
      render: (r: AntimicrobialConsumptionRow) => r.atc_code ?? "---",
    },
    {
      key: "total_ddd" as const,
      label: "Total DDD",
      render: (r: AntimicrobialConsumptionRow) => r.total_ddd.toFixed(2),
    },
    {
      key: "patient_days" as const,
      label: "Patient Days",
      render: (r: AntimicrobialConsumptionRow) => String(r.patient_days),
    },
    {
      key: "ddd_per_1000" as const,
      label: "DDD/1000",
      render: (r: AntimicrobialConsumptionRow) => r.ddd_per_1000.toFixed(2),
    },
  ];

  const prophColumns = [
    {
      key: "procedure_type" as const,
      label: "Procedure",
      render: (r: SurgicalProphylaxisRow) => r.procedure_type,
    },
    {
      key: "total_cases" as const,
      label: "Total Cases",
      render: (r: SurgicalProphylaxisRow) => String(r.total_cases),
    },
    {
      key: "timely_count" as const,
      label: "Timely",
      render: (r: SurgicalProphylaxisRow) => String(r.timely_count),
    },
    {
      key: "compliance_pct" as const,
      label: "Compliance %",
      render: (r: SurgicalProphylaxisRow) => (
        <Badge
          tone={r.compliance_pct >= 90 ? "success" : r.compliance_pct >= 70 ? "warning" : "danger"}
        >
          {r.compliance_pct.toFixed(1)}%
        </Badge>
      ),
    },
  ];

  return (
    <Stack>
      <Group justify="space-between">
        <SegmentedControl
          value={subView}
          onChange={setSubView}
          data={[
            { value: "hai-rates", label: "HAI Rates" },
            { value: "device-util", label: "Device Utilization" },
            { value: "am-consumption", label: "Antimicrobial" },
            { value: "prophylaxis", label: "Prophylaxis" },
            { value: "culture-sens", label: "Culture Sensitivity" },
            { value: "mdro", label: "MDRO" },
          ]}
        />
        <Group>
          <DateInput
            value={from}
            onChange={(d) => setFrom(d)}
            placeholder="From"
            clearable
            w={140}
          />
          <DateInput value={to} onChange={(d) => setTo(d)} placeholder="To" clearable w={140} />
        </Group>
      </Group>

      {subView === "hai-rates" && (
        <Paper p="md" withBorder>
          <Title order={5} mb="md">
            HAI Rates per 1000 Patient Days
          </Title>
          {haiLoading ? (
            <Text c="dimmed">Loading...</Text>
          ) : haiRates.length === 0 ? (
            <Text c="dimmed">No data</Text>
          ) : (
            <BarChart
              h={350}
              data={haiRates.map((r) => ({
                infection_type: r.infection_type,
                rate: r.rate_per_1000,
              }))}
              dataKey="infection_type"
              series={[{ name: "rate", label: "Rate / 1000", color: "danger" }]}
              tickLine="y"
            />
          )}
        </Paper>
      )}

      {subView === "device-util" && (
        <DataTable
          columns={deviceUtilColumns}
          data={deviceUtil}
          loading={deviceLoading}
          rowKey={(r) => `${r.unit_name}-${r.device_type}`}
          emptyTitle="No device utilization data"
        />
      )}

      {subView === "am-consumption" && (
        <DataTable
          columns={amColumns}
          data={amConsumption}
          loading={amLoading}
          rowKey={(r) => r.drug_name}
          emptyTitle="No antimicrobial consumption data"
        />
      )}

      {subView === "prophylaxis" && (
        <DataTable
          columns={prophColumns}
          data={prophylaxis}
          loading={prophLoading}
          rowKey={(r) => r.procedure_type}
          emptyTitle="No surgical prophylaxis data"
        />
      )}

      {subView === "culture-sens" && (
        <Paper p="md" withBorder>
          <Title order={5} mb="md">
            Culture Sensitivity Matrix
          </Title>
          {csLoading ? (
            <Text c="dimmed">Loading...</Text>
          ) : csMatrix.antibiotics.length === 0 ? (
            <Text c="dimmed">No culture sensitivity data</Text>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <Table striped withTableBorder withColumnBorders>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Organism</Table.Th>
                    {csMatrix.antibiotics.map((ab) => (
                      <Table.Th key={ab}>{ab}</Table.Th>
                    ))}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {Object.entries(csMatrix.orgMap).map(([org, abMap]) => (
                    <Table.Tr key={org}>
                      <Table.Td fw={500}>{org}</Table.Td>
                      {csMatrix.antibiotics.map((ab) => {
                        const row = abMap[ab];
                        if (!row) return <Table.Td key={ab}>---</Table.Td>;
                        const pct = row.sensitivity_pct;
                        const color = pct >= 70 ? "success" : pct >= 40 ? "warning" : "danger";
                        return (
                          <Table.Td key={ab}>
                            <Tooltip
                              label={`S:${row.sensitive_count} I:${row.intermediate_count} R:${row.resistant_count} (n=${row.total_tests})`}
                            >
                              <Badge tone={color} size="sm">
                                {pct.toFixed(0)}%
                              </Badge>
                            </Tooltip>
                          </Table.Td>
                        );
                      })}
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </div>
          )}
        </Paper>
      )}

      {subView === "mdro" && (
        <Paper p="md" withBorder>
          <Title order={5} mb="md">
            MDRO Tracking (Rate per 1000 Patient Days)
          </Title>
          {mdroLoading ? (
            <Text c="dimmed">Loading...</Text>
          ) : mdroChartData.length === 0 ? (
            <Text c="dimmed">No MDRO data</Text>
          ) : (
            <LineChart
              h={350}
              data={mdroChartData}
              dataKey="month"
              series={mdroSeries}
              curveType="monotone"
              withLegend
              withTooltip
            />
          )}
        </Paper>
      )}
    </Stack>
  );
}

// ── IC Meetings Tab ──────────────────────────────────────
