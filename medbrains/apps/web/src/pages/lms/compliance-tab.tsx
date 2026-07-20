// Lms ComplianceTab — split from lms.tsx (pure move).

import { Progress, Text } from "@mantine/core";
import type { LmsComplianceRow } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { DataTable } from "@/components";
import { Badge } from "@/components/ui";
import { lmsService } from "@/services/lms.service";
import { EmptyState } from "./empty-state";

export function ComplianceTab() {
  const { data: rows = [], isLoading } = useQuery<LmsComplianceRow[]>({
    queryKey: ["lms-compliance"],
    queryFn: () => lmsService.complianceOverview(),
  });

  if (isLoading) return <EmptyState message="Loading compliance data..." />;
  if (rows.length === 0) return <EmptyState message="No compliance data available." />;

  return (
    <DataTable
      columns={[
        {
          key: "course_title",
          label: "Course",
          render: (row: LmsComplianceRow) => row.course_title,
        },
        {
          key: "is_mandatory",
          label: "Mandatory",
          render: (row: LmsComplianceRow) =>
            row.is_mandatory ? (
              <Badge size="xs" tone="danger">
                Yes
              </Badge>
            ) : (
              <Text size="xs" c="dimmed">
                No
              </Text>
            ),
        },
        {
          key: "total_enrolled",
          label: "Enrolled",
          render: (row: LmsComplianceRow) => row.total_enrolled,
        },
        {
          key: "completed",
          label: "Completed",
          render: (row: LmsComplianceRow) => row.completed,
        },
        {
          key: "overdue",
          label: "Overdue",
          render: (row: LmsComplianceRow) =>
            row.overdue > 0 ? (
              <Badge size="xs" tone="danger">
                {row.overdue}
              </Badge>
            ) : (
              0
            ),
        },
        {
          key: "completion_pct",
          label: "Completion %",
          render: (row: LmsComplianceRow) => {
            const pct =
              row.total_enrolled > 0 ? Math.round((row.completed / row.total_enrolled) * 100) : 0;
            return <Progress value={pct} size="sm" color={pct >= 80 ? "green" : "yellow"} />;
          },
        },
      ]}
      data={rows}
      rowKey={(row) => row.course_id}
    />
  );
}

// ── Certificates Tab ───────────────────────────────────
