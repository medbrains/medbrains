/**
 * File an unmatched study under an order. The person picks the patient and
 * the order; what the images say stays on screen beside it. The server
 * compares the two and, when anything differs, refuses without a note
 * saying how the patient was confirmed — that message is shown here.
 */
import { Group, Select, Stack, Text } from "@mantine/core";
import type { RadiologyOrder, UnmatchedStudy } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { QueryError } from "@/components/QueryError";
import { Alert, Button, Modal, TextArea, toast } from "@/components/ui";
import { radiologyService } from "@/services/radiology.service";
import { ImagesSay } from "./images-say";

interface LinkStudyModalProps {
  study: UnmatchedStudy;
  onClose: () => void;
}

/** Orders that can still take images: not cancelled, none filed yet. */
function openOrders(orders: RadiologyOrder[]) {
  return orders
    .filter((o) => o.status !== "cancelled" && !o.pacs_study_uid)
    .map((o) => ({
      value: o.id,
      label: `${o.accession_number} · ${o.body_part ?? "no body part"} · ${o.status} · ${new Date(o.created_at).toLocaleDateString()}`,
    }));
}

export function LinkStudyModal({ study, onClose }: LinkStudyModalProps) {
  const qc = useQueryClient();
  const [patientId, setPatientId] = useState("");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const orders = useQuery({
    queryKey: ["radiology-orders", { patient_id: patientId }],
    queryFn: () => radiologyService.listRadiologyOrders({ patient_id: patientId, per_page: "100" }),
    enabled: patientId !== "",
  });
  const options = useMemo(() => openOrders(orders.data?.orders ?? []), [orders.data]);
  const link = useMutation({
    mutationFn: () =>
      radiologyService.linkUnmatchedStudy(study.id, {
        order_id: orderId ?? "",
        ...(note.trim() ? { note: note.trim() } : {}),
      }),
    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: ["radiology-unmatched-studies"] });
      void qc.invalidateQueries({ queryKey: ["radiology-orders"] });
      toast.success(
        result.dose_captured
          ? "The images are on the order and its dose was read from the PACS."
          : "The images are on the order. Enter its radiation dose there.",
        { title: "Study filed" },
      );
      onClose();
    },
  });

  return (
    <Modal opened onClose={onClose} title="File study under an order" size="lg">
      <Stack>
        <ImagesSay study={study} />
        <PatientSearchSelect
          label="Patient"
          required
          value={patientId}
          onChange={(id) => {
            setPatientId(id);
            setOrderId(null);
          }}
          initialSearch={study.dicom_patient_id ?? study.dicom_patient_name ?? undefined}
          allowCreate={false}
        />
        {orders.isError ? (
          <QueryError error={orders.error} onRetry={() => void orders.refetch()} />
        ) : (
          patientId !== "" && (
            <Select
              label="Imaging order"
              required
              data={options}
              value={orderId}
              onChange={setOrderId}
              nothingFoundMessage="No open order"
              description={
                options.length === 0 && !orders.isLoading
                  ? "This patient has no order waiting for images. Create one on the Orders tab first — it is what the exam is billed and reported under."
                  : undefined
              }
            />
          )
        )}
        <TextArea
          label="Note"
          description="Needed when the images and the patient differ: say how you confirmed it is this patient."
          value={note}
          onChange={(e) => setNote(e.currentTarget.value)}
        />
        {link.isError && (
          <Alert tone="danger" title="Not filed">
            {(link.error as Error).message}
          </Alert>
        )}
        <Group justify="flex-end">
          <Button tone="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            tone="primary"
            disabled={!orderId}
            loading={link.isPending}
            onClick={() => link.mutate()}
          >
            File study
          </Button>
        </Group>
        <Text size="xs" c="dimmed">
          Filing puts these images in the patient&apos;s record and completes the order.
        </Text>
      </Stack>
    </Modal>
  );
}
