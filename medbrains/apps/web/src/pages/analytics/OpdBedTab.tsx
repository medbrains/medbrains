import { useState, useMemo } from "react";
import {
  Card,
  Group,
  Progress,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { LineChart } from "@mantine/charts";
import { useQuery } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import type { OpdFootfallRow, BedOccupancyRow } from "@medbrains/types";
import { DataTable } from "../../components";
import type { Column } from "../../components/DataTable";

// ── Helpers ──────────────────────────────────────────────

function toIso(d: string | null): string | undefined {
  return d ?? undefined;
}

function pct(v: number): string {
  return `${v.toFixed(1)}%`;
}

function occupancyColor(v: number): string {
  if (v > 85) return "danger";
  if (v > 70) return "warning";
  return "success";
}

// ── Component ────────────────────────────────────────────

export function OpdBedTab() {
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [section, setSection] = useState("opd");

  const params = useMemo(
    () => ({ from: toIso(from), to: toIso(to) }),
    [from, to],
  );

  return (
    <Stack gap="md">
      <Card withBorder p="sm">
        <Group>
          <DateInput label="From" value={from} onChange={(v) => setFrom(v)} clearable maxDate={to ? new Date(to) : undefined} size="sm" />
          <DateInput label="To" value={to} onChange={(v) => setTo(v)} clearable minDate={from ? new Date(from) : undefined} size="sm" />
          <SegmentedControl
            value={section}
            onChange={setSection}
            data={[
              { label: "OPD Footfall", value: "opd" },
              { label: "Bed Occupancy", value: "bed" },
            ]}
            mt="xl"
          />
        </Group>
      </Card>

      {section === "opd" && <OpdSection params={params} />}
      {section === "bed" && <BedSection />}
    </Stack>
  );
}

// ── OPD Footfall Section ────────────────────────────────

function OpdSection({ params }: { params: { from?: string; to?: string } }) {
  const { data, isLoading } = useQuery({
    queryKey: ["analytics", "opd-footfall", params],
    queryFn: () => api.getOpdFootfall(params),
  });

  const rows = data ?? [];

  // Aggregate by date for chart
  const chartData = useMemo(() => {
    const byDate = new Map<string, number>();
    for (const r of rows) {
      byDate.set(r.date, (byDate.get(r.date) ?? 0) + r.visit_count);
    }
    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, Visits: count }));
  }, [rows]);

  const totals = useMemo(() => {
    let visits = 0;
    let newP = 0;
    let followUps = 0;
    for (const r of rows) {
      visits += r.visit_count;
      newP += r.new_patients;
      followUps += r.follow_ups;
    }
    return { visits, newP, followUps };
  }, [rows]);

  const columns: Column<OpdFootfallRow>[] = [
    { key: "date", label: "Date", render: (r) => <Text size="sm">{r.date}</Text> },
    { key: "dept", label: "Department", render: (r) => <Text size="sm">{r.department_name}</Text> },
    { key: "visits", label: "Visits", render: (r) => <Text size="sm" fw={600}>{r.visit_count}</Text> },
    { key: "new", label: "New", render: (r) => <Text size="sm" c="success">{r.new_patients}</Text> },
    { key: "follow", label: "Follow-ups", render: (r) => <Text size="sm">{r.follow_ups}</Text> },
  ];

  return (
    <Stack gap="md">
      <SimpleGrid cols={3}>
        <StatCard label="Total Visits" value={totals.visits.toLocaleString()} />
        <StatCard label="New Patients" value={totals.newP.toLocaleString()} />
        <StatCard label="Follow-ups" value={totals.followUps.toLocaleString()} />
      </SimpleGrid>

      {chartData.length > 0 && (
        <Card withBorder>
          <Text fw={600} mb="sm">Daily OPD Footfall</Text>
          <LineChart
            h={300}
            data={chartData}
            dataKey="date"
            series={[{ name: "Visits", color: "blue.6" }]}
            curveType="monotone"
            tickLine="y"
          />
        </Card>
      )}

      <DataTable columns={columns} data={rows} loading={isLoading} rowKey={(r) => `${r.date}-${r.department_name}`} />
    </Stack>
  );
}

// ── Bed Occupancy Section ───────────────────────────────

function BedSection() {
  const { data, isLoading } = useQuery({
    queryKey: ["analytics", "bed-occupancy"],
    queryFn: () => api.getBedOccupancy(),
    refetchInterval: 60_000,
  });

  const rows = data ?? [];

  const overall = useMemo(() => {
    let totalBeds = 0;
    let totalOccupied = 0;
    for (const r of rows) {
      totalBeds += r.total_beds;
      totalOccupied += r.occupied;
    }
    const occupancyPct = totalBeds > 0 ? (totalOccupied / totalBeds) * 100 : 0;
    return { totalBeds, totalOccupied, vacant: totalBeds - totalOccupied, occupancyPct };
  }, [rows]);

  const columns: Column<BedOccupancyRow>[] = [
    { key: "ward", label: "Ward", render: (r) => <Text size="sm">{r.ward_name}</Text> },
    { key: "total", label: "Total Beds", render: (r) => <Text size="sm">{r.total_beds}</Text> },
    { key: "occupied", label: "Occupied", render: (r) => <Text size="sm">{r.occupied}</Text> },
    { key: "vacant", label: "Vacant", render: (r) => <Text size="sm" c="success">{r.vacant}</Text> },
    {
      key: "pct",
      label: "Occupancy",
      render: (r) => (
        <Text size="sm" fw={600} c={occupancyColor(r.occupancy_pct)}>
          {pct(r.occupancy_pct)}
        </Text>
      ),
    },
  ];

  return (
    <Stack gap="md">
      <SimpleGrid cols={4}>
        <StatCard label="Total Beds" value={overall.totalBeds.toLocaleString()} />
        <StatCard label="Occupied" value={overall.totalOccupied.toLocaleString()} />
        <StatCard label="Vacant" value={overall.vacant.toLocaleString()} />
        <StatCard label="Overall Occupancy" value={pct(overall.occupancyPct)} color={occupancyColor(overall.occupancyPct)} />
      </SimpleGrid>

      {/* Ward progress bars */}
      {rows.length > 0 && (
        <Card withBorder>
          <Text fw={600} mb="md">Ward Occupancy</Text>
          <Stack gap="sm">
            {rows.map((r) => (
              <Group key={r.ward_name} gap="sm">
                <Text size="sm" w={160} truncate>{r.ward_name}</Text>
                <Progress
                  value={r.occupancy_pct}
                  color={occupancyColor(r.occupancy_pct)}
                  size="lg"
                  style={{ flex: 1 }}
                />
                <Text size="sm" w={80} ta="right" fw={600} c={occupancyColor(r.occupancy_pct)}>
                  {pct(r.occupancy_pct)}
                </Text>
              </Group>
            ))}
          </Stack>
        </Card>
      )}

      <DataTable columns={columns} data={rows} loading={isLoading} rowKey={(r) => r.ward_name} />
    </Stack>
  );
}

// ── Sub-components ───────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <Card withBorder p="lg">
      <Text c="dimmed" size="sm">{label}</Text>
      <Text fw={700} size="xl" c={color}>{value}</Text>
    </Card>
  );
}
