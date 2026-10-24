import { Radio, Stack, Text } from "@mantine/core";
import type { AbhaCloseAction, AbhaOtpVia } from "@medbrains/types";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Button, Checkbox, Input, Modal, SegmentedControl, TextArea } from "@/components/ui";
import { abhaService } from "@/services/abha.service";

const digitsOnly = (v: string) => v.replace(/\D/g, "");

const CONSEQUENCE: Record<AbhaCloseAction, string> = {
  delete:
    "Deleting closes the patient's ABHA for good. They cannot sign in with it again, and records linked to it can no longer be reached through it. It cannot be undone.",
  deactivate:
    "Deactivating closes the patient's ABHA until they reactivate it themselves, in their ABHA app or through ABDM.",
};

interface AbhaCloseModalProps {
  verificationId: string;
  opened: boolean;
  onClose: () => void;
  /** ABDM closed it; `message` says so for the screen. */
  onClosed: (message: string) => void;
}

/**
 * Delete or deactivate the patient's ABHA at their request (PROF_ABHA_605).
 * Staff confirm the patient asked, give the reason, and the patient reads
 * out ABDM's OTP — nothing closes without it.
 */
export function AbhaCloseModal({ verificationId, opened, onClose, onClosed }: AbhaCloseModalProps) {
  return (
    <Modal opened={opened} onClose={onClose} title="Delete or deactivate the ABHA">
      {opened && <CloseFlow verificationId={verificationId} onClosed={onClosed} />}
    </Modal>
  );
}

function CloseFlow({
  verificationId,
  onClosed,
}: Pick<AbhaCloseModalProps, "verificationId" | "onClosed">) {
  const [action, setAction] = useState<AbhaCloseAction>("deactivate");
  const [via, setVia] = useState<AbhaOtpVia>("aadhaar");
  const [reason, setReason] = useState("");
  const [asked, setAsked] = useState(false);
  const [otpSent, setOtpSent] = useState<string | null>(null);
  const [otp, setOtp] = useState("");

  const send = useMutation({
    mutationFn: () => abhaService.requestClose(verificationId, { action, otp_via: via, reason }),
    onSuccess: (r) => setOtpSent(r.message ?? "ABDM has sent the patient an OTP."),
  });
  const confirm = useMutation({
    mutationFn: () => abhaService.verifyClose(verificationId, otp),
    onSuccess: (r) => {
      const unlinked = r.unlinked
        ? ` It is no longer on ${r.unlinked.name} (${r.unlinked.uhid}) here.`
        : "";
      onClosed(`${r.message ?? "ABDM has closed the ABHA."}${unlinked}`);
    },
  });
  const failure = [send, confirm].find((m) => m.isError)?.error;

  return (
    <Stack>
      {failure && (
        <Alert tone="danger" title="ABDM said no">
          {failure.message}
        </Alert>
      )}
      <SegmentedControl
        aria-label="Close the ABHA how"
        value={action}
        onChange={(v) => setAction(v as AbhaCloseAction)}
        disabled={Boolean(otpSent)}
        data={[
          { value: "deactivate", label: "Deactivate" },
          { value: "delete", label: "Delete for good" },
        ]}
      />
      <Alert tone={action === "delete" ? "danger" : "warning"} title="What this does">
        {CONSEQUENCE[action]} The hospital stops using the ABHA on the patient's record.
      </Alert>
      {!otpSent ? (
        <>
          <Radio.Group
            label="Send the OTP to"
            value={via}
            onChange={(v) => setVia(v as AbhaOtpVia)}
          >
            <Stack gap={6} mt={6}>
              <Radio value="aadhaar" label="The mobile linked to their Aadhaar" />
              <Radio value="abdm" label="The mobile on their ABHA" />
            </Stack>
          </Radio.Group>
          <TextArea
            label="Why is the patient closing their ABHA?"
            required
            maxLength={300}
            value={reason}
            onChange={(e) => setReason(e.currentTarget.value)}
          />
          <Checkbox
            label="The patient asked for this and is here to read out the OTP"
            checked={asked}
            onChange={(e) => setAsked(e.currentTarget.checked)}
          />
          <Button
            tone="danger"
            disabled={!asked || !reason.trim()}
            loading={send.isPending}
            onClick={() => send.mutate()}
          >
            Send the OTP
          </Button>
        </>
      ) : (
        <>
          <Text size="sm">{otpSent} Ask the patient to read it out.</Text>
          <Input
            label="OTP"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(digitsOnly(e.currentTarget.value))}
            data-autofocus
          />
          <Button
            tone="danger"
            disabled={otp.length !== 6}
            loading={confirm.isPending}
            onClick={() => confirm.mutate()}
          >
            {action === "delete" ? "Delete the ABHA" : "Deactivate the ABHA"}
          </Button>
        </>
      )}
    </Stack>
  );
}
