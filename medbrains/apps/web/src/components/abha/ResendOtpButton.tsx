import { Stack, Text } from "@mantine/core";
import { Button } from "@/components/ui";
import { ABHA_MESSAGES } from "./abhaRules";

interface ResendOtpButtonProps {
  /** Seconds before ABDM will send another OTP. */
  wait: number;
  /** Resends ABDM still allows for this OTP; null when unknown. */
  resendsLeft: number | null;
  loading: boolean;
  onResend: () => void;
}

/**
 * "Resend OTP" as ABDM's M1 rules allow it: after 60 seconds, at most twice,
 * with the count shown (CRT_ABHA_106, VRFY_ABHA_405). After the second, NHA's
 * 30-minute message; the server refuses resends for those 30 minutes too.
 */
export function ResendOtpButton({ wait, resendsLeft, loading, onResend }: ResendOtpButtonProps) {
  if (resendsLeft === 0) {
    return (
      <Text size="sm" c="danger" role="status">
        {ABHA_MESSAGES.resendLocked}
      </Text>
    );
  }
  return (
    <Stack gap={2} align="flex-start">
      <Button tone="ghost" disabled={wait > 0} loading={loading} onClick={onResend}>
        {wait > 0 ? `Resend OTP in ${wait}s` : "Resend OTP"}
      </Button>
      {resendsLeft !== null && (
        <Text size="xs" c="dimmed">
          {resendsLeft === 1 ? "One resend left" : `${resendsLeft} resends left`}
        </Text>
      )}
    </Stack>
  );
}
