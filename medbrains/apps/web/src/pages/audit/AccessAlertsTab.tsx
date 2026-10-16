/**
 * Alerts raised from record access: a flagged patient opened, a record opened
 * at night by someone not on shift, one person opening dozens of patients in
 * an hour. The reviewer reads what happened and marks it reviewed, with a
 * note; the note is added to the record, never written over it.
 */
import { SegmentedControl, Stack, Text, Textarea } from "@mantine/core";
import type { AccessAlert } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { DataTable } from "@/components";
import { Alert, Badge, Button, Modal, toast } from "@/components/ui";
import { auditService } from "@/services/audit.service";

const KIND: Record<string, string> = {
  sensitive_record: "Flagged record opened",
  after_hours: "Opened after hours",
  bulk_access: "Many records in an hour",
};

export function AccessAlertsTab() {
  const qc = useQueryClient();
  const [show, setShow] = useState("open");
  const [reviewing, setReviewing] = useState<AccessAlert | null>(null);
  const [note, setNote] = useState("");
  const alerts = useQuery({ queryKey: ["access-alerts"], queryFn: auditService.listAccessAlerts });
  const rows = useMemo(
    () => (alerts.data ?? []).filter((a) => (show === "open" ? !a.acknowledged_at : true)),
    [alerts.data, show],
  );
  const review = useMutation({
    mutationFn: (a: AccessAlert) =>
      auditService.acknowledgeAccessAlert(a.id, { notes: note.trim() || undefined }),
    onSuccess: () => {
      setReviewing(null);
      setNote("");
      void qc.invalidateQueries({ queryKey: ["access-alerts"] });
      toast.success("Marked reviewed");
    },
  });
  return (
    <Stack gap="md">
      <SegmentedControl
        aria-label="Show"
        value={show}
        onChange={setShow}
        data={[
          { value: "open", label: "To review" },
          { value: "all", label: "All" },
        ]}
      />
      <DataTable
        data={rows}
        loading={alerts.isLoading}
        error={alerts.error}
        onRetry={() => void alerts.refetch()}
        rowKey={(r) => r.id}
        emptyTitle={show === "open" ? "Nothing to review" : "No access alerts"}
        columns={[
          {
            key: "kind",
            label: "Alert",
            render: (r) => (
              <Badge
                tone={
                  r.access_type === "sensitive_record" && r.is_authorized === false
                    ? "danger"
                    : "warning"
                }
              >
                {KIND[r.access_type] ?? r.access_type}
              </Badge>
            ),
          },
          { key: "who", label: "Who", render: (r) => <Text size="sm">{r.user_name ?? "—"}</Text> },
          {
            key: "patient",
            label: "Patient",
            render: (r) => <Text size="sm">{r.patient_name ?? "—"}</Text>,
          },
          {
            key: "what",
            label: "What happened",
            render: (r) => (
              <Text size="sm" style={{ whiteSpace: "pre-line" }}>
                {r.notes}
              </Text>
            ),
          },
          {
            key: "when",
            label: "When",
            render: (r) => <Text size="sm">{new Date(r.created_at).toLocaleString()}</Text>,
          },
          {
            key: "review",
            label: "",
            render: (r) =>
              r.acknowledged_at ? (
                <Text size="xs" c="dimmed">
                  Reviewed
                </Text>
              ) : (
                <Button tone="secondary" size="compact-xs" onClick={() => setReviewing(r)}>
                  Review
                </Button>
              ),
          },
        ]}
      />
      <Modal
        opened={reviewing !== null}
        onClose={() => setReviewing(null)}
        title="Review access alert"
        size="md"
      >
        {reviewing && (
          <Stack gap="sm">
            <Text size="sm">
              {reviewing.user_name} — {KIND[reviewing.access_type] ?? reviewing.access_type}
            </Text>
            <Text size="sm" c="dimmed">
              {reviewing.notes}
            </Text>
            <Textarea
              label="What you found"
              autosize
              minRows={2}
              value={note}
              onChange={(e) => {
                const { value } = e.currentTarget;
                setNote(value);
              }}
            />
            {review.isError && <Alert tone="danger">{review.error.message}</Alert>}
            <Button
              tone="primary"
              loading={review.isPending}
              onClick={() => review.mutate(reviewing)}
            >
              Mark reviewed
            </Button>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}
