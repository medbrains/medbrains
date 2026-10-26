// Clinical-kb ReportsTab — split from clinical-kb.tsx (pure move).

import { Group, Stack, Text } from "@mantine/core";
import type { NotifiableReport } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import { Badge, Button } from "@/components/ui";
import { ckbService } from "@/services/ckb.service";
import { ResolveReportModal } from "./resolve-report-modal";

/** Where the worklist row was detected, as the reporter reads it. */
const SOURCE_LABEL: Record<string, string> = {
  opd_diagnosis: "OPD diagnosis",
  ipd_diagnosis: "Inpatient diagnosis",
  er_diagnosis: "Emergency",
  discharge_summary: "Discharge summary",
  lab_result: "Lab result",
};

function isOverdue(r: NotifiableReport): boolean {
  return r.status === "pending" && !!r.due_at && new Date(r.due_at).getTime() < Date.now();
}

export function ReportsTab({ canManage, canList }: { canManage: boolean; canList: boolean }) {
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [target, setTarget] = useState<NotifiableReport | null>(null);

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["ckb-notifiable-reports", statusFilter],
    queryFn: () => ckbService.listNotifiableReports(statusFilter || undefined),
    enabled: canList,
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
            key: "case_class",
            label: "Case",
            render: (r) => (
              <Group gap={6} wrap="nowrap">
                <Badge tone={r.case_class === "confirmed" ? "danger" : "warning"}>
                  {r.case_class === "confirmed" ? "L" : "P"}
                </Badge>
                <Text size="sm">
                  {r.case_class === "confirmed" ? "Lab-confirmed" : "Presumptive"}
                </Text>
              </Group>
            ),
          },
          {
            key: "detected_at",
            label: "Detected",
            render: (r) => (
              <Stack gap={0}>
                <Text size="sm">{new Date(r.detected_at).toLocaleString()}</Text>
                <Text size="xs" c="dimmed">
                  {SOURCE_LABEL[r.source ?? ""] ?? r.source ?? "—"}
                </Text>
              </Stack>
            ),
          },
          {
            key: "due_at",
            label: "Due",
            render: (r) =>
              r.due_at ? (
                <Group gap={4} wrap="nowrap">
                  <Text size="sm">{new Date(r.due_at).toLocaleString()}</Text>
                  {isOverdue(r) && <Badge tone="danger">Overdue</Badge>}
                </Group>
              ) : (
                <Text size="sm" c="dimmed">
                  —
                </Text>
              ),
          },
          {
            key: "status",
            label: "Status",
            render: (r) => (
              <Text size="sm" fw={600}>
                {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
              </Text>
            ),
          },
          {
            key: "report_ref",
            label: "Ref",
            render: (r) => (
              <Stack gap={0}>
                <Text size="sm" c="dimmed">
                  {r.report_ref ?? "—"}
                </Text>
                {r.presumptive_ref && (
                  <Text size="xs" c="dimmed">
                    P-form: {r.presumptive_ref}
                  </Text>
                )}
              </Stack>
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
