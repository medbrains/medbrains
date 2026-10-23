import { Stack, Text } from "@mantine/core";
import { Button } from "@/components/ui";

interface ResendOtpButtonProps {
  /** Seconds before ABDM will send another OTP. */
  wait: number;
  /** Resends ABDM still allows for this OTP; null when unknown. */
  resendsLeft: number | null;
  loading: boolean;
  onResend: () => void;
}

/**
 * "Resend OTP" as ABDM's M1 rules allow it: after 60 seconds, at most twice
 * (CRT_ABHA_106, VRFY_ABHA_405). The server enforces the same cap.
 */
export function ResendOtpButton({ wait, resendsLeft, loading, onResend }: ResendOtpButtonProps) {
  if (resendsLeft === 0) {
    return (
      <Text size="sm" c="dimmed">
        The OTP cannot be sent again. If it has not arrived, close this and start again.
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
