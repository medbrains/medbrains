// An employee's training history, where its certificates print from.
// Training was recorded from the Training tab and never listed anywhere.
import { Text } from "@mantine/core";
import type { TrainingProgram, TrainingRecord } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { DataTable } from "@/components";
import { printColumn } from "@/components/Print/printColumn";
import { Alert, Badge } from "@/components/ui";
import { hrService } from "@/services/hr.service";
import { statusBadgeTone } from "./shared";

export function EmployeeTrainingRecords({
  employeeId,
  enabled,
}: {
  employeeId: string;
  enabled: boolean;
}) {
  const records = useQuery({
    queryKey: ["hr-training-records", employeeId],
    queryFn: () => hrService.listTrainingRecords(employeeId),
    enabled,
  });
  const programs = useQuery({
    queryKey: ["hr-training-programs"],
    queryFn: () => hrService.listTrainingPrograms(),
    enabled,
  });
  const programName = useMemo(
    () => new Map((programs.data ?? []).map((p: TrainingProgram) => [p.id, p.name])),
    [programs.data],
  );

  // A failed load is not an empty history.
  if (records.isError) {
    return (
      <Alert tone="danger" title="Training records could not be loaded">
        {(records.error as Error).message}
      </Alert>
    );
  }

  return (
    <DataTable
      data={records.data ?? []}
      loading={records.isLoading}
      rowKey={(r: TrainingRecord) => r.id}
      emptyTitle="No training recorded"
      columns={[
        {
          key: "program",
          label: "Program",
          render: (r: TrainingRecord) => (
            <Text size="sm">{programName.get(r.program_id) ?? "Unknown program"}</Text>
          ),
        },
        {
          key: "date",
          label: "Date",
          render: (r: TrainingRecord) => <Text size="sm">{r.training_date}</Text>,
        },
        {
          key: "status",
          label: "Status",
          render: (r: TrainingRecord) => (
            <Badge size="sm" tone={statusBadgeTone(r.status)}>
              {r.status.replace(/_/g, " ")}
            </Badge>
          ),
        },
        {
          key: "certificate",
          label: "Certificate",
          render: (r: TrainingRecord) => <Text size="sm">{r.certificate_no ?? "—"}</Text>,
        },
        // The server prints a certificate only for completed training.
        printColumn<TrainingRecord>("training_record", {
          when: (r) => r.status === "completed",
          label: (r) => r.certificate_no ?? undefined,
        }),
      ]}
    />
  );
}
