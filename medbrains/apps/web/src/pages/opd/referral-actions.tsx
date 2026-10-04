import { Group, Modal, Stack, Textarea } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P, type ReferralWithNames } from "@medbrains/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button, Checkbox, toast } from "@/components/ui";
import { opdService } from "@/services/opd.service";

type Dialog = "decline" | "opinion" | null;

/** Lists a referral step can change: both sides' referral lists and queues. */
const REFRESHED = [["patient-referrals"], ["opd-referral-tracking"], ["opd-queue"]] as const;

/**
 * What the caller may do with a referral, as the server decided it
 * (`addressed_to_me`, `sent_by_me`): accept or decline one sent to them,
 * give the opinion once accepted, withdraw one they sent while pending.
 */
export function ReferralActions({ referral }: { referral: ReferralWithNames }) {
  const canRespond = useHasPermission(P.OPD.REFERRALS_RESPOND);
  const canCancel = useHasPermission(P.OPD.REFERRALS_CANCEL);
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [text, setText] = useState("");
  const [sendBack, setSendBack] = useState(true);

  const close = () => {
    setDialog(null);
    setText("");
    setSendBack(true);
  };
  const step = useMutation({
    mutationFn: (run: () => Promise<{ token_number: string | null }>) => run(),
    onSuccess: (result) => {
      for (const key of REFRESHED) void queryClient.invalidateQueries({ queryKey: key });
      if (result.token_number) {
        toast.success(`Queue number ${result.token_number}`, { title: "Referral updated" });
      }
      close();
    },
    onError: (error: Error) => toast.error(error.message, { title: "Referral not updated" }),
  });

  const isPending = referral.status === "pending";
  const answerable = referral.addressed_to_me && canRespond;
  const showAccept = answerable && isPending;
  const showOpinion = answerable && referral.status === "accepted";
  const showWithdraw = referral.sent_by_me && canCancel && isPending;
  if (!showAccept && !showOpinion && !showWithdraw) return null;

  const from = referral.from_doctor_name
    ? `Dr. ${referral.from_doctor_name}`
    : "the referring doctor";
  return (
    <Group gap="xs" mt="xs">
      {showAccept && (
        <>
          <Button
            tone="primary"
            size="xs"
            loading={step.isPending}
            onClick={() => step.mutate(() => opdService.acceptReferral(referral.id))}
          >
            Accept
          </Button>
          <Button tone="tertiary" size="xs" onClick={() => setDialog("decline")}>
            Decline
          </Button>
        </>
      )}
      {showOpinion && (
        <Button tone="primary" size="xs" onClick={() => setDialog("opinion")}>
          Give opinion
        </Button>
      )}
      {showWithdraw && (
        <Button
          tone="danger-ghost"
          size="xs"
          loading={step.isPending}
          onClick={() => step.mutate(() => opdService.cancelReferral(referral.id))}
        >
          Withdraw
        </Button>
      )}

      <Modal
        opened={dialog !== null}
        onClose={close}
        title={dialog === "decline" ? "Decline referral" : "Give opinion"}
      >
        <Stack gap="sm">
          <Textarea
            label={dialog === "decline" ? "Why you are declining" : "Your opinion"}
            value={text}
            onChange={(e) => setText(e.currentTarget.value)}
            autosize
            minRows={3}
            required
          />
          {dialog === "opinion" && (
            <Checkbox
              label={`Send the patient back to ${from}`}
              checked={sendBack}
              onChange={(e) => setSendBack(e.currentTarget.checked)}
            />
          )}
          <Group justify="flex-end">
            <Button tone="ghost" onClick={close}>
              Cancel
            </Button>
            <Button
              tone="primary"
              disabled={!text.trim()}
              loading={step.isPending}
              onClick={() =>
                step.mutate(() =>
                  dialog === "decline"
                    ? opdService.declineReferral(referral.id, { reason: text })
                    : opdService.completeReferral(referral.id, {
                        opinion: text,
                        return_to_referrer: sendBack,
                      }),
                )
              }
            >
              {dialog === "decline" ? "Decline" : "Send opinion"}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Group>
  );
}
