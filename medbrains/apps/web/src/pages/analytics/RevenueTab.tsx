import { useState, useMemo } from "react";
import {
  Button,
  Card,
  Group,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { BarChart } from "@mantine/charts";
import { IconDownload } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import { P } from "@medbrains/types";
import type { DeptRevenueRow, AnalyticsDoctorRevenueRow } from "@medbrains/types";
import { useHasPermission } from "@medbrains/stores";
import { DataTable } from "../../components";
import type { Column } from "../../components/DataTable";

// ── Helpers ──────────────────────────────────────────────

function fmt(value: number): string {
  return value.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
}

function toIso(d: string | null): string | undefined {
  return d ?? undefined;
}

function toRows<T>(value: T[] | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

// ── Component ────────────────────────────────────────────

export function RevenueTab() {
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [view, setView] = useState("department");
  const canExport = useHasPermission(P.ANALYTICS.EXPORT);

  const params = useMemo(
    () => ({ from: toIso(from), to: toIso(to) }),
    [from, to],
  );

  const deptQ = useQuery({
    queryKey: ["analytics", "dept-revenue", params],
    queryFn: () => api.getDeptRevenue(params),
  });

  const doctorQ = useQuery({
    queryKey: ["analytics", "doctor-revenue", params],
    queryFn: () => api.getDoctorRevenue(params),
  });

  const deptData = toRows(deptQ.data);
  const doctorData = toRows(doctorQ.data);

  const totalRevenue = useMemo(
    () => deptData.reduce((s, r) => s + r.revenue, 0),
    [deptData],
  );
  const totalInvoices = useMemo(
    () => deptData.reduce((s, r) => s + r.invoice_count, 0),
    [deptData],
  );

  const handleExport = () => {
    api.exportAnalytics({ report: "revenue", from: toIso(from), to: toIso(to) });
  };

  // ── Columns ──────────────────────────────────────────

  const deptColumns: Column<DeptRevenueRow>[] = [
    { key: "dept", label: "Department", render: (r) => <Text size="sm">{r.department_name}</Text> },
    { key: "revenue", label: "Revenue", render: (r) => <Text size="sm" fw={600}>{fmt(r.revenue)}</Text> },
    { key: "invoices", label: "Invoices", render: (r) => <Text size="sm">{r.invoice_count.toLocaleString()}</Text> },
  ];

  const doctorColumns: Column<AnalyticsDoctorRevenueRow>[] = [
    { key: "doctor", label: "Doctor", render: (r) => <Text size="sm">{r.doctor_name}</Text> },
    { key: "dept", label: "Department", render: (r) => <Text size="sm">{r.department_name}</Text> },
    { key: "revenue", label: "Revenue", render: (r) => <Text size="sm" fw={600}>{fmt(r.revenue)}</Text> },
    { key: "patients", label: "Patients", render: (r) => <Text size="sm">{r.patient_count.toLocaleString()}</Text> },
  ];

  // ── Chart data ────────────────────────────────────────

  const deptChartData = useMemo(
    () =>
      [...deptData]
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10)
        .map((r) => ({ name: r.department_name, Revenue: r.revenue })),
    [deptData],
  );

  const doctorChartData = useMemo(
    () =>
      [...doctorData]
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10)
        .map((r) => ({ name: r.doctor_name, Revenue: r.revenue })),
    [doctorData],
  );

  return (
    <Stack gap="md">
      {/* Filters */}
      <Card withBorder p="sm">
        <Group>
          <DateInput
            label="From"
            value={from}
            onChange={(v) => setFrom(v)}
            clearable
            maxDate={to ? new Date(to) : undefined}
            size="sm"
          />
          <DateInput
            label="To"
            value={to}
            onChange={(v) => setTo(v)}
            clearable
            minDate={from ? new Date(from) : undefined}
            size="sm"
          />
          <SegmentedControl
            value={view}
            onChange={setView}
            data={[
              { label: "By Department", value: "department" },
              { label: "By Doctor", value: "doctor" },
            ]}
            mt="xl"
          />
          {canExport && (
            <Button
              variant="light"
              leftSection={<IconDownload size={16} />}
              onClick={handleExport}
              mt="xl"
              size="sm"
            >
              Export
            </Button>
          )}
        </Group>
      </Card>

      {/* Stat cards */}
      <SimpleGrid cols={2}>
        <StatCard label="Total Revenue" value={fmt(totalRevenue)} />
        <StatCard label="Total Invoices" value={totalInvoices.toLocaleString()} />
      </SimpleGrid>

      {/* Chart */}
      {view === "department" && deptChartData.length > 0 && (
        <Card withBorder>
          <Text fw={600} mb="sm">Top 10 Departments by Revenue</Text>
          <BarChart
            h={300}
            data={deptChartData}
            dataKey="name"
            series={[{ name: "Revenue", color: "blue.6" }]}
            tickLine="y"
          />
        </Card>
      )}
      {view === "doctor" && doctorChartData.length > 0 && (
        <Card withBorder>
          <Text fw={600} mb="sm">Top 10 Doctors by Revenue</Text>
          <BarChart
            h={300}
            data={doctorChartData}
            dataKey="name"
            series={[{ name: "Revenue", color: "teal.6" }]}
            tickLine="y"
          />
        </Card>
      )}

      {/* Table */}
      {view === "department" ? (
        <DataTable
          columns={deptColumns}
          data={deptData}
          loading={deptQ.isLoading}
          rowKey={(r) => r.department_name}
        />
      ) : (
        <DataTable
          columns={doctorColumns}
          data={doctorData}
          loading={doctorQ.isLoading}
          rowKey={(r) => `${r.doctor_name}-${r.department_name}`}
        />
      )}
    </Stack>
  );
}

// ── Sub-components ───────────────────────────────────────

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card withBorder p="lg">
      <Text c="dimmed" size="sm">{label}</Text>
      <Text fw={700} size="xl">{value}</Text>
    </Card>
  );
}
