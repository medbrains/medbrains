import { Group, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { DecideSuspectedMlcRequest, ErVisit } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconGavel } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Button, Modal, TextArea, toast } from "@/components/ui";
import { emergencyService } from "@/services/emergency.service";
import { humanizeWorkflowValue } from "./shared";

type Decision = DecideSuspectedMlcRequest["decision"];

/** Saves the doctor's decision on a possible MLC and refreshes the visit, the ER list and the MLC register. */
function useDecideSuspectedMlc(visitId: string, onDone: () => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: DecideSuspectedMlcRequest) =>
      emergencyService.decideSuspectedMlc(visitId, data),
    onSuccess: (result) => {
      for (const key of [["er-visit", visitId], ["er-visits"], ["mlc-cases"]]) {
        void qc.invalidateQueries({ queryKey: key });
      }
      onDone();
      toast.success(
        result.is_mlc
          ? "MLC case registered and linked to this visit."
          : "Recorded: not a medico-legal case.",
      );
    },
    onError: (error: Error) => toast.error(error.message, { title: "Could not save the decision" }),
  });
}

/** The second step of a decision: registering asks for a yes, dismissing asks for the reason. */
function DecisionModal({
  decision,
  onClose,
  visitId,
}: {
  decision: Decision | null;
  onClose: () => void;
  visitId: string;
}) {
  const [reason, setReason] = useState("");
  const decide = useDecideSuspectedMlc(visitId, onClose);
  const confirming = decision === "confirm";
  return (
    <Modal
      opened={decision !== null}
      onClose={onClose}
      size="md"
      title={confirming ? "Register a medico-legal case?" : "Why is this not a medico-legal case?"}
    >
      <Stack>
        {confirming ? (
          <Text size="sm">
            This gives the visit an MLC number and starts the police intimation. It cannot be undone
            from here.
          </Text>
        ) : (
          <TextArea
            label="Reason"
            description="Kept on the visit and in the audit trail."
            required
            minRows={3}
            value={reason}
            onChange={(event) => setReason(event.currentTarget.value)}
          />
        )}
        <Group justify="flex-end">
          <Button tone="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            tone="primary"
            loading={decide.isPending}
            disabled={!confirming && reason.trim() === ""}
            onClick={() =>
              decision && decide.mutate({ decision, reason: reason.trim() || undefined })
            }
          >
            {confirming ? "Register MLC case" : "Record as not an MLC"}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

/**
 * On the ER visit: a possible medico-legal case the desk saved from the
 * complaint, for a doctor to confirm or dismiss. Each button is gated on the
 * permission its call needs; everyone else reads who decides. A dismissal
 * stays on the page with its reason, until an MLC case is registered on the
 * visit: then the case is the answer and the old dismissal would contradict it.
 */
export function SuspectedMlcAlert({ visit }: { visit: ErVisit }) {
  const canReview = useHasPermission(P.EMERGENCY.MLC_REVIEW_SUSPECTED);
  const canRegister = useHasPermission(P.EMERGENCY.MLC_CREATE);
  const [decision, setDecision] = useState<Decision | null>(null);
  if (visit.is_mlc) return null;
  if (visit.mlc_suspicion === "dismissed") {
    return (
      <Alert
        tone="neutral"
        icon={<IconGavel size={16} />}
        title="Reviewed: not a medico-legal case"
      >
        {visit.mlc_suspicion_reason ?? "The reason is restricted for your role."}
      </Alert>
    );
  }
  if (visit.mlc_suspicion !== "suspected") return null;
  return (
    <Alert
      tone="warning"
      icon={<IconGavel size={16} />}
      title="Possible medico-legal case: doctor to confirm"
    >
      <Stack gap="xs">
        <Text size="sm">
          The complaint reads like {humanizeWorkflowValue(visit.mlc_suspected_type ?? "an MLC")}.
          The visit is saved and care continues. No MLC case is registered until a doctor confirms.
        </Text>
        {canReview ? (
          <Group gap="xs">
            {canRegister && (
              <Button tone="primary" size="xs" onClick={() => setDecision("confirm")}>
                Confirm MLC
              </Button>
            )}
            <Button tone="secondary" size="xs" onClick={() => setDecision("dismiss")}>
              Not a medico-legal case
            </Button>
          </Group>
        ) : (
          <Text size="sm">A doctor confirms or dismisses this.</Text>
        )}
      </Stack>
      <DecisionModal decision={decision} onClose={() => setDecision(null)} visitId={visit.id} />
    </Alert>
  );
}
