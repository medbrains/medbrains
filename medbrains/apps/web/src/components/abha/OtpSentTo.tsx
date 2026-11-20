import { Text } from "@mantine/core";

interface OtpSentToProps {
  /** ABDM's masked destination, when it said where the OTP went. */
  to?: string | null;
}

/** Where ABDM sent the OTP, masked as ABDM gave it, so the desk can say it aloud. */
export function OtpSentTo({ to }: OtpSentToProps) {
  if (!to) return null;
  return (
    <Text size="sm" ff="monospace">
      OTP sent to {to}
    </Text>
  );
}
