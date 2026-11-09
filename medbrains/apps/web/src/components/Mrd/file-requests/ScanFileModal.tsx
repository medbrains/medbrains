import { Stack, Text } from "@mantine/core";
import type { MrdFileRequest, MrdFileScanStep } from "@medbrains/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Button, Input, Modal, toast } from "@/components/ui";
import { mrdService } from "@/services/mrd.service";

interface ScanFileModalProps {
  request: MrdFileRequest | null;
  step: MrdFileScanStep;
  onClose: () => void;
}

const STEP_TITLE: Record<MrdFileScanStep, string> = {
  picked: "Scan at the shelf",
  delivered: "Scan at the clinic",
};

/**
 * The runner's scan: a barcode scanner types into the field and presses
 * Enter, or the runner types the file number. The server refuses any other
 * file's barcode, and the reason is shown here.
 */
export function ScanFileModal({ request, step, onClose }: ScanFileModalProps) {
  const qc = useQueryClient();
  const [barcode, setBarcode] = useState("");
  const scan = useMutation({
    mutationFn: () => mrdService.scanMrdFileRequest(request?.id ?? "", { barcode, step }),
    onSuccess: (row) => {
      void qc.invalidateQueries({ queryKey: ["mrd-file-requests"] });
      toast.success(`File ${row.record_number}: ${step === "picked" ? "picked up" : "delivered"}`);
      setBarcode("");
      onClose();
    },
  });

  /** Close and forget what was typed and any refusal. */
  const close = () => {
    setBarcode("");
    scan.reset();
    onClose();
  };

  return (
    <Modal opened={request !== null} onClose={close} title={STEP_TITLE[step]} size="sm">
      <Stack
        component="form"
        gap="sm"
        onSubmit={(event) => {
          event.preventDefault();
          if (barcode.trim()) scan.mutate();
        }}
      >
        <Text size="sm">
          File {request?.record_number} for {request?.patient_name}
        </Text>
        <Input
          label="File barcode"
          description="Scan the folder, or type the file number"
          value={barcode}
          onChange={(event) => setBarcode(event.currentTarget.value)}
          data-autofocus
          autoComplete="off"
          required
        />
        {scan.isError && (
          <Alert tone="danger" title="Not recorded" role="alert">
            {scan.error.message}
          </Alert>
        )}
        <Button tone="primary" type="submit" loading={scan.isPending} disabled={!barcode.trim()}>
          {step === "picked" ? "Picked up" : "Delivered"}
        </Button>
      </Stack>
    </Modal>
  );
}
