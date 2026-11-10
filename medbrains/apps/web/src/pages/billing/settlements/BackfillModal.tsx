// One-time catch-up for claims settled before postings existed: count what
// would be filed first, then file pending postings. Nothing is approved here.

import { Stack, Text } from "@mantine/core";
import type { ClaimSettlementBackfillResult } from "@medbrains/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { rupees } from "@/components/payments/collect/collect-math";
import { Alert, Modal, toast } from "@/components/ui";
import { billingService } from "@/services/billing.service";

export function BackfillModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [preview, setPreview] = useState<ClaimSettlementBackfillResult | null>(null);
  const [done, setDone] = useState<ClaimSettlementBackfillResult | null>(null);
  const run = useMutation({
    mutationFn: (dryRun: boolean) => billingService.backfillClaimSettlements({ dry_run: dryRun }),
    onSuccess: (result) => {
      if (result.dry_run) {
        setPreview(result);
        return;
      }
      setDone(result);
      queryClient.invalidateQueries({ queryKey: ["billing", "claim-settlements"] });
      toast.success(`${result.filed} pending postings filed`);
    },
  });
  const close = () => {
    setPreview(null);
    setDone(null);
    run.reset();
    onClose();
  };
  const primary = done
    ? { label: "Close", onClick: close }
    : preview
      ? {
          label: `File ${preview.claims} pending postings`,
          onClick: () => run.mutate(false),
          loading: run.isPending,
          disabled: preview.claims === 0,
        }
      : { label: "Count settled claims", onClick: () => run.mutate(true), loading: run.isPending };

  return (
    <Modal
      opened={opened}
      onClose={close}
      title="File past settlements"
      size="md"
      primaryAction={primary}
      secondaryAction={done ? undefined : { label: "Cancel", onClick: close }}
    >
      <Stack>
        <Text size="sm">
          Claims settled before this queue existed never reached their bills. This files one pending
          posting for each, for finance to approve or reject one by one. It approves nothing and
          moves no money.
        </Text>
        {run.error && (
          <Alert tone="danger" title="Could not run">
            {run.error.message}
          </Alert>
        )}
        {preview && !done && (
          <Alert tone="info" title="Dry run">
            {preview.claims} settled claims, {rupees(Number(preview.amount))} in all, have no
            posting yet.
          </Alert>
        )}
        {done && (
          <Alert tone="success" title="Filed">
            {done.filed} pending postings filed for {rupees(Number(done.amount))}. They are in the
            Pending list.
          </Alert>
        )}
      </Stack>
    </Modal>
  );
}
