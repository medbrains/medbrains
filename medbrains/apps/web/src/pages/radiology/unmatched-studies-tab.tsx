/**
 * Studies the PACS received that no order claimed — a walk-in X-ray, a
 * mistyped accession, a study from elsewhere. The radiology desk files each
 * under the order it belongs to, or dismisses it with a reason. Until then
 * the images are in no patient's record, so the open queue is the default.
 */
import { Group, Stack, Text } from "@mantine/core";
import type { UnmatchedStudy, UnmatchedStudyStatus } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import { QueryError } from "@/components/QueryError";
import { Button, Modal, SegmentedControl, TextArea, toast } from "@/components/ui";
import { radiologyService } from "@/services/radiology.service";
import { ImagesSay } from "./images-say";
import { LinkStudyModal } from "./link-study-modal";

const STATUSES: { value: UnmatchedStudyStatus; label: string }[] = [
  { value: "open", label: "To match" },
  { value: "linked", label: "Filed" },
  { value: "dismissed", label: "Dismissed" },
];

function DismissModal({ study, onClose }: { study: UnmatchedStudy; onClose: () => void }) {
  const qc = useQueryClient();
  const [reason, setReason] = useState("");
  const dismiss = useMutation({
    mutationFn: () => radiologyService.dismissUnmatchedStudy(study.id, reason.trim()),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["radiology-unmatched-studies"] });
      toast.success("It stays in the PACS but leaves this queue.", { title: "Study dismissed" });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message, { title: "Not dismissed" }),
  });
  return (
    <Modal opened onClose={onClose} title="Dismiss study">
      <Stack>
        <ImagesSay study={study} />
        <TextArea
          label="Reason"
          required
          description="A QA phantom, a test exposure, a duplicate — why these images are nobody's."
          value={reason}
          onChange={(e) => setReason(e.currentTarget.value)}
        />
        <Group justify="flex-end">
          <Button tone="secondary" onClick={onClose}>
            Keep it
          </Button>
          <Button
            tone="danger"
            disabled={reason.trim() === ""}
            loading={dismiss.isPending}
            onClick={() => dismiss.mutate()}
          >
            Dismiss
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

const who = (s: UnmatchedStudy) =>
  [s.dicom_patient_name, s.dicom_patient_id, s.dicom_birth_date, s.dicom_sex]
    .filter(Boolean)
    .join(" · ") || "No patient details on the images";

export function UnmatchedStudiesTab() {
  const [status, setStatus] = useState<UnmatchedStudyStatus>("open");
  const [linking, setLinking] = useState<UnmatchedStudy | null>(null);
  const [dismissing, setDismissing] = useState<UnmatchedStudy | null>(null);
  const queue = useQuery({
    queryKey: ["radiology-unmatched-studies", status],
    queryFn: () => radiologyService.listUnmatchedStudies(status),
  });
  return (
    <Stack>
      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          Studies the PACS could not file under an order. Match each to its patient&apos;s order —
          never by name alone.
        </Text>
        <SegmentedControl
          aria-label="Which studies"
          data={STATUSES}
          value={status}
          onChange={(v) => setStatus(v as UnmatchedStudyStatus)}
        />
      </Group>
      {queue.isError ? (
        <QueryError error={queue.error} onRetry={() => void queue.refetch()} />
      ) : (
        <DataTable
          loading={queue.isLoading}
          data={queue.data ?? []}
          rowKey={(s) => s.id}
          emptyTitle={status === "open" ? "Nothing to match" : "None"}
          columns={[
            {
              key: "received",
              label: "Received",
              render: (s: UnmatchedStudy) => new Date(s.created_at).toLocaleString(),
            },
            { key: "who", label: "The images say", render: who },
            {
              key: "study",
              label: "Study",
              render: (s: UnmatchedStudy) =>
                `${s.modality ?? "?"} · ${s.study_description ?? "No description"} · ${s.instance_count} image${s.instance_count === 1 ? "" : "s"}`,
            },
            {
              key: "accession",
              label: "Accession",
              render: (s: UnmatchedStudy) => s.accession_number ?? "—",
            },
            {
              key: "action",
              label: status === "open" ? "" : "Note",
              render: (s: UnmatchedStudy) =>
                s.status === "open" ? (
                  <Group gap="xs" wrap="nowrap">
                    <Button size="xs" tone="primary" onClick={() => setLinking(s)}>
                      File under order
                    </Button>
                    <Button size="xs" tone="ghost" onClick={() => setDismissing(s)}>
                      Dismiss
                    </Button>
                  </Group>
                ) : (
                  (s.resolution_note ?? "—")
                ),
            },
          ]}
        />
      )}
      {linking && <LinkStudyModal study={linking} onClose={() => setLinking(null)} />}
      {dismissing && <DismissModal study={dismissing} onClose={() => setDismissing(null)} />}
    </Stack>
  );
}
