/**
 * The order's dose: what is recorded (typed, or read from the scanner), the
 * patient's running total, and — for whoever records dose — the entry form and
 * a way to mark a wrong figure as entered in error, with a reason.
 */
import { Group, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { RadiationDoseRecord } from "@medbrains/types";
import { P } from "@medbrains/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import { CumulativeDoseNotice } from "@/components/Radiology/CumulativeDoseNotice";
import { Badge, Button, Modal, TextArea, toast } from "@/components/ui";
import { DOSE_SOURCE_LABEL, doseFigures } from "@/lib/radiation-dose";
import { radiologyService } from "@/services/radiology.service";
import { DoseEntryForm } from "./dose-entry-form";

interface DoseTabProps {
  orderId: string;
  patientId: string;
  records: RadiationDoseRecord[];
}

function EnteredInErrorModal({
  record,
  patientId,
  onClose,
}: {
  record: RadiationDoseRecord;
  patientId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [reason, setReason] = useState("");
  const mark = useMutation({
    mutationFn: () => radiologyService.markRadiationDoseEnteredInError(record.id, reason.trim()),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["radiology-order", record.order_id] });
      void qc.invalidateQueries({ queryKey: ["cumulative-dose", patientId] });
      void qc.invalidateQueries({ queryKey: ["patient-dose-records", patientId] });
      toast.success("It no longer counts towards the cumulative dose.", {
        title: "Marked as entered in error",
      });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message, { title: "Not changed" }),
  });
  return (
    <Modal opened onClose={onClose} title="Mark dose as entered in error">
      <Stack>
        <Text size="sm">{doseFigures(record).join(" · ")}</Text>
        <TextArea
          label="Reason"
          required
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
            loading={mark.isPending}
            onClick={() => mark.mutate()}
          >
            Mark entered in error
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

export function DoseTab({ orderId, patientId, records }: DoseTabProps) {
  const canRecord = useHasPermission(P.RADIOLOGY.DOSE_RECORD);
  const [wrong, setWrong] = useState<RadiationDoseRecord | null>(null);
  return (
    <Stack>
      <CumulativeDoseNotice patientId={patientId} />
      {records.length > 0 ? (
        <DataTable
          columns={[
            {
              key: "recorded",
              label: "Recorded",
              render: (d: RadiationDoseRecord) => new Date(d.recorded_at).toLocaleString(),
            },
            {
              key: "source",
              label: "From",
              render: (d: RadiationDoseRecord) => (
                <Badge size="sm" tone={d.source === "manual" ? "neutral" : "info"}>
                  {DOSE_SOURCE_LABEL[d.source]}
                </Badge>
              ),
            },
            {
              key: "figures",
              label: "Dose",
              render: (d: RadiationDoseRecord) => doseFigures(d).join(" · ") || "—",
            },
            {
              key: "actions",
              label: "",
              render: (d: RadiationDoseRecord) =>
                canRecord ? (
                  <Button size="xs" tone="ghost" onClick={() => setWrong(d)}>
                    Entered in error
                  </Button>
                ) : null,
            },
          ]}
          data={records}
          rowKey={(d) => d.id}
        />
      ) : (
        <Text c="dimmed" size="sm">
          No dose recorded for this exam yet.
        </Text>
      )}
      {canRecord && <DoseEntryForm orderId={orderId} patientId={patientId} />}
      {wrong && (
        <EnteredInErrorModal record={wrong} patientId={patientId} onClose={() => setWrong(null)} />
      )}
    </Stack>
  );
}
