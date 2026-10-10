import { Group, Stack, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useHasPermission } from "@medbrains/stores";
import { P, type PendingSignoffEntry } from "@medbrains/types";
import { IconCheck, IconX } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button, Modal, TextArea, toast } from "@/components/ui";
import { signoffService } from "@/services/signoff.service";

interface RefillDecisionProps {
  item: PendingSignoffEntry;
}

/**
 * A patient's refill request, decided by the prescriber: approving sends the
 * refill to the pharmacy; declining tells the patient why.
 */
export function RefillDecision({ item }: RefillDecisionProps) {
  const canDecide = useHasPermission(P.DOCTOR.REFILL_REQUESTS.DECIDE);
  const queryClient = useQueryClient();
  const [declining, decline] = useDisclosure(false);
  const [reason, setReason] = useState("");

  const decide = useMutation({
    mutationFn: (approve: boolean) =>
      signoffService.decideRefillRequest(item.record_id, {
        approve,
        ...(approve ? {} : { note: reason.trim() }),
      }),
    onSuccess: (request) => {
      toast.success(
        request.status === "sent_to_pharmacy"
          ? "The refill is in the pharmacy's queue."
          : "The patient will see your reason.",
        { title: request.status === "sent_to_pharmacy" ? "Refill approved" : "Refill declined" },
      );
      decline.close();
      void queryClient.invalidateQueries({ queryKey: ["my-pending-signoffs"] });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Not decided" }),
  });

  if (!canDecide) return null;
  return (
    <>
      <Group gap="xs" wrap="nowrap">
        <Button size="xs" tone="secondary" leftSection={<IconX size={14} />} onClick={decline.open}>
          Decline
        </Button>
        <Button
          size="xs"
          tone="primary"
          leftSection={<IconCheck size={14} />}
          loading={decide.isPending && !declining}
          onClick={() => decide.mutate(true)}
        >
          Approve refill
        </Button>
      </Group>
      <Modal opened={declining} onClose={decline.close} title="Decline refill">
        <Stack gap="sm">
          <Text size="sm">{item.summary}</Text>
          <TextArea
            label="Reason, for the patient"
            placeholder="Please book a review — your blood pressure needs checking first."
            value={reason}
            onChange={(e) => setReason(e.currentTarget.value)}
            required
          />
          <Group justify="flex-end">
            <Button tone="secondary" onClick={decline.close}>
              Cancel
            </Button>
            <Button
              tone="danger"
              disabled={reason.trim().length === 0}
              loading={decide.isPending}
              onClick={() => decide.mutate(false)}
            >
              Decline refill
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
