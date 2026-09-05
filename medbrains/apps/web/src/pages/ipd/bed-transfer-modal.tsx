// IPD BedTransferModal — split from ipd.tsx (pure move).

import { Textarea, TextInput } from "@mantine/core";
import type { BedTransferRequest } from "@medbrains/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FormModal, useClinicalEmit } from "@/components";
import { BedSelect } from "@/components/BedSelect";
import { toast } from "@/components/ui";
import { ipdService } from "@/services/ipd.service";
import { emitIpdBedMovementEvent } from "./shared";

export function BedTransferModal({
  admissionId,
  opened,
  onClose,
  patientId,
}: {
  admissionId: string;
  opened: boolean;
  onClose: () => void;
  patientId: string;
}) {
  const { t } = useTranslation("ipd");
  const queryClient = useQueryClient();
  const emit = useClinicalEmit();
  const [toBedId, setToBedId] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  const transferMutation = useMutation({
    mutationFn: (data: BedTransferRequest) => ipdService.bedTransfer(admissionId, data),
    onSuccess: (response) => {
      void queryClient.invalidateQueries({ queryKey: ["admission-detail", admissionId] });
      void queryClient.invalidateQueries({ queryKey: ["admissions"] });
      // The board's keys, not "bed-dashboard" — that name was left behind when
      // the board was split out of ipd.tsx, so a transfer refreshed nothing
      // and the vacated bed went on showing its old occupant until reload.
      void queryClient.invalidateQueries({ queryKey: ["ipd-bed-dashboard-summary"] });
      void queryClient.invalidateQueries({ queryKey: ["ipd-bed-dashboard-beds"] });
      void queryClient.invalidateQueries({ queryKey: ["ipd-transfers", admissionId] });
      toast.success(t("notify.bedTransferCompleted"), { title: t("notify.transferred") });
      emitIpdBedMovementEvent(emit, response, patientId, notes.trim());
      onClose();
      setToBedId("");
      setReason("");
      setNotes("");
    },
    onError: () => {
      toast.error(t("notify.bedTransferFailed"), { title: t("notify.error") });
    },
  });

  return (
    <FormModal
      opened={opened}
      onClose={onClose}
      title={t("title.bedTransfer")}
      size="md"
      onSubmit={(e) => {
        e.preventDefault();
        transferMutation.mutate({ to_bed_id: toBedId, reason, notes: notes || undefined });
      }}
      submitLabel={t("transfer")}
      submitting={transferMutation.isPending}
      submitDisabled={!toBedId.trim() || !reason.trim()}
    >
      <BedSelect
        label={t("label.targetBed")}
        value={toBedId}
        onChange={(id) => setToBedId(id)}
        required
      />
      <TextInput
        label={t("label.reason")}
        placeholder={t("placeholder.reasonForTransfer")}
        value={reason}
        onChange={(e) => setReason(e.currentTarget.value)}
        required
      />
      <Textarea
        label={t("label.notes")}
        placeholder={t("placeholder.optionalTransferNotes")}
        value={notes}
        onChange={(e) => setNotes(e.currentTarget.value)}
      />
    </FormModal>
  );
}

// ═══════════════════════════════════════════════════════════
// ── Expected Discharges Tab ───────────────────────────────
// ═══════════════════════════════════════════════════════════
