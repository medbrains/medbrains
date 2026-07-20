// Clinical-kb ReportsTab — split from clinical-kb.tsx (pure move).

import { Group, Stack, Text } from "@mantine/core";
import type { NotifiableReport } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import { Badge, type BadgeTone, Button } from "@/components/ui";
import { ckbService } from "@/services/ckb.service";
import { ResolveReportModal } from "./resolve-report-modal";

const STATUS_TONE: Record<string, BadgeTone> = {
  pending: "warning",
  submitted: "success",
  exempted: "neutral",
};

export function ReportsTab({ canManage }: { canManage: boolean }) {
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [target, setTarget] = useState<NotifiableReport | null>(null);

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["ckb-notifiable-reports", statusFilter],
    queryFn: () => ckbService.listNotifiableReports(statusFilter || undefined),
  });

  return (
    <Stack>
      <Group gap="xs">
        {["pending", "submitted", "exempted", ""].map((s) => (
          <Button
            key={s || "all"}
            size="xs"
            tone={statusFilter === s ? "primary" : "ghost"}
            onClick={() => setStatusFilter(s)}
          >
            {s || "All"}
          </Button>
        ))}
      </Group>
      <DataTable
        columns={[
          {
            key: "disease_name",
            label: "Disease",
            render: (r) => (
              <Stack gap={0}>
                <Text size="sm" fw={600}>
                  {r.disease_name}
                </Text>
                <Text size="xs" c="dimmed" ff="var(--mb-font-mono)">
                  {r.icd10_code}
                  {r.reporting_body ? ` · ${r.reporting_body}` : ""}
                </Text>
              </Stack>
            ),
          },
          {
            key: "detected_at",
            label: "Detected",
            render: (r) => <Text size="sm">{new Date(r.detected_at).toLocaleString()}</Text>,
          },
          {
            key: "status",
            label: "Status",
            render: (r) => <Badge tone={STATUS_TONE[r.status] ?? "neutral"}>{r.status}</Badge>,
          },
          {
            key: "report_ref",
            label: "Ref",
            render: (r) => (
              <Text size="sm" c="dimmed">
                {r.report_ref ?? "—"}
              </Text>
            ),
          },
          {
            key: "actions",
            label: "",
            render: (r) =>
              canManage && r.status === "pending" ? (
                <Button size="xs" tone="primary" onClick={() => setTarget(r)}>
                  Resolve
                </Button>
              ) : null,
          },
        ]}
        data={reports}
        loading={isLoading}
        rowKey={(r) => r.id}
      />
      <ResolveReportModal report={target} onClose={() => setTarget(null)} />
    </Stack>
  );
}
