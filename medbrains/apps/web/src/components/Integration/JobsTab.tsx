import { Badge, Card, Group, Select, SimpleGrid, Stack, Text } from "@mantine/core";
import { api } from "@medbrains/api";
import type { JobQueueRow, JobStats } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "../DataTable";

const STATUS_COLORS: Record<string, string> = {
  pending: "blue",
  running: "yellow",
  completed: "green",
  failed: "red",
  dead_letter: "grape",
};

const STATUS_OPTIONS = [
  { label: "All", value: "" },
  { label: "Pending", value: "pending" },
  { label: "Running", value: "running" },
  { label: "Completed", value: "completed" },
  { label: "Failed", value: "failed" },
  { label: "Dead Letter", value: "dead_letter" },
];

export function JobsTab() {
  const [statusFilter, setStatusFilter] = useState("");

  const { data: stats } = useQuery({
    queryKey: ["orchestration", "job-stats"],
    queryFn: () => api.getJobStats(),
    refetchInterval: 10_000,
  });

  const { data: jobsData, isLoading } = useQuery({
    queryKey: ["orchestration", "jobs", statusFilter],
    queryFn: () =>
      api.listJobs(statusFilter ? { status: statusFilter } : undefined),
    refetchInterval: 10_000,
  });

  const jobs = jobsData?.jobs ?? [];

  const columns = [
    {
      key: "job_type",
      label: "Type",
      render: (row: JobQueueRow) => (
        <Text size="sm" fw={500}>
          {row.job_type}
        </Text>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (row: JobQueueRow) => (
        <Badge
          color={STATUS_COLORS[row.status] ?? "gray"}
          variant="light"
          size="sm"
        >
          {row.status.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      key: "priority",
      label: "Priority",
      render: (row: JobQueueRow) => <Text size="sm">{row.priority}</Text>,
    },
    {
      key: "retries",
      label: "Retries",
      render: (row: JobQueueRow) => (
        <Text size="sm">
          {row.retry_count}/{row.max_retries}
        </Text>
      ),
    },
    {
      key: "error",
      label: "Error",
      render: (row: JobQueueRow) => (
        <Text size="xs" c="red" lineClamp={1}>
          {row.error ?? ""}
        </Text>
      ),
    },
    {
      key: "created_at",
      label: "Created",
      render: (row: JobQueueRow) => (
        <Text size="xs" c="dimmed">
          {formatRelative(row.created_at)}
        </Text>
      ),
    },
  ];

  return (
    <Stack gap="md">
      {stats && <JobStatsCards stats={stats} />}

      <DataTable<JobQueueRow>
        columns={columns}
        data={jobs}
        loading={isLoading}
        rowKey={(r) => r.id}
        emptyTitle="No jobs"
        emptyDescription="Job queue is empty"
        toolbar={
          <Select
            data={STATUS_OPTIONS}
            value={statusFilter}
            onChange={(v) => setStatusFilter(v ?? "")}
            size="xs"
            w={140}
            placeholder="Status"
          />
        }
      />
    </Stack>
  );
}

function JobStatsCards({ stats }: { stats: JobStats }) {
  const items: { label: string; value: number; color: string }[] = [
    { label: "Pending", value: stats.pending, color: "blue" },
    { label: "Running", value: stats.running, color: "yellow" },
    { label: "Completed", value: stats.completed, color: "green" },
    { label: "Failed", value: stats.failed, color: "red" },
    { label: "Dead Letter", value: stats.dead_letter, color: "grape" },
  ];

  return (
    <SimpleGrid cols={{ base: 2, sm: 3, lg: 5 }}>
      {items.map((item) => (
        <Card key={item.label} withBorder padding="sm">
          <Group justify="space-between">
            <Text size="xs" c="dimmed">
              {item.label}
            </Text>
            <Badge size="xs" color={item.color} variant="light" circle>
              {item.value}
            </Badge>
          </Group>
          <Text size="xl" fw={700} mt={4}>
            {item.value.toLocaleString()}
          </Text>
        </Card>
      ))}
    </SimpleGrid>
  );
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
