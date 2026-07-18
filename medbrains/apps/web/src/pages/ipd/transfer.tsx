// IPD TransferTab — split from ipd.tsx (pure move).

import { emitIpdBedMovementEvent } from "./shared";
import { useClinicalEmit } from "@/components";
import { BedSelect } from "@/components/BedSelect";
import { Button, toast } from "@/components/ui";
import { ipdService } from "@/services/ipd.service";
import { Stack, Text, Textarea } from "@mantine/core";
import { IconBed } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";

export function TransferTab({
  admissionId,
  canManage,
  patientId,
  status,
}: {
  admissionId: string;
  canManage: boolean;
  patientId: string;
  status: string;
}) {
  const { t } = useTranslation("ipd");
  const queryClient = useQueryClient();
  const [bedId, setBedId] = useState("");
  const [notes, setNotes] = useState("");
  const emit = useClinicalEmit();

  const transferMutation = useMutation({
    mutationFn: () =>
      ipdService.bedTransfer(admissionId, {
        notes: notes.trim(),
        reason: notes.trim(),
        to_bed_id: bedId,
      }),
    onSuccess: (response) => {
      void queryClient.invalidateQueries({ queryKey: ["admission-detail", admissionId] });
      void queryClient.invalidateQueries({ queryKey: ["admissions"] });
      void queryClient.invalidateQueries({ queryKey: ["bed-dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["ipd-transfers", admissionId] });
      toast.success(t("notify.bedTransferRecorded"), { title: t("notify.transferred") });
      emitIpdBedMovementEvent(emit, response, patientId, notes.trim());
      setBedId("");
      setNotes("");
    },
    onError: (e: Error) => toast.error(e.message, { title: "Transfer blocked" }),
  });

  if (status !== "admitted") {
    return (
      <Text c="dimmed" size="sm">
        {t("transferIsOnlyAvailableForAdmittedPatients.")}
      </Text>
    );
  }

  return (
    <Stack>
      {canManage ? (
        <>
          <BedSelect
            label={t("label.newBed")}
            value={bedId}
            onChange={(id) => setBedId(id)}
            required
          />
          <Textarea
            label={t("label.transferNotes")}
            value={notes}
            onChange={(e) => setNotes(e.currentTarget.value)}
          />
          <Button
            tone="primary"
            leftSection={<IconBed size={16} />}
            onClick={() => transferMutation.mutate()}
            loading={transferMutation.isPending}
            disabled={!bedId || !notes.trim()}
          >
            {t("label.transferBed")}
          </Button>
        </>
      ) : (
        <Text c="dimmed" size="sm">
          {t("youDoNotHavePermissionToTransferBeds.")}
        </Text>
      )}
    </Stack>
  );
}

// ── Discharge ──────────────────────────────────────────
