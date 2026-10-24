import { Text } from "@mantine/core";
import type { PendingSafetyReview } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import type { Column } from "@/components/DataTable";
import { PatientNameCell } from "@/components/PatientNameCell";
import { Button } from "@/components/ui";
import { psychiatryService } from "@/services/psychiatry.service";
import { formatDateTime } from "./labels";
import { SafetyReviewModal } from "./SafetyReviewModal";

/** Every positive PHQ-9 item 9 still waiting for its review — oldest first. */
export function SafetyWorklist() {
  const query = useQuery({
    queryKey: ["psych-safety-pending"],
    queryFn: () => psychiatryService.pendingSafetyReviews(),
  });
  const [reviewing, setReviewing] = useState<string | null>(null);
  const columns: Column<PendingSafetyReview>[] = [
    {
      key: "patient",
      label: "Patient",
      render: (r) => <PatientNameCell patientId={r.patient_id} showUhid={false} />,
    },
    {
      key: "when",
      label: "Screened",
      render: (r) => <Text size="sm">{formatDateTime(r.administered_at)}</Text>,
    },
    { key: "total", label: "PHQ-9 total", render: (r) => <Text size="sm">{r.total}</Text> },
    {
      key: "act",
      label: "",
      render: (r) => (
        <Button tone="danger" size="xs" onClick={() => setReviewing(r.screening_id)}>
          Record review
        </Button>
      ),
    },
  ];
  return (
    <>
      <DataTable
        columns={columns}
        data={query.data ?? []}
        loading={query.isLoading}
        error={query.error ?? undefined}
        onRetry={() => void query.refetch()}
        rowKey={(r) => r.screening_id}
        emptyTitle="No suicide-risk reviews pending"
      />
      <SafetyReviewModal screeningId={reviewing} onClose={() => setReviewing(null)} />
    </>
  );
}
