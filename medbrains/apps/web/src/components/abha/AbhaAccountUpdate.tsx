import { Group, Stack, Text } from "@mantine/core";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Button, Input } from "@/components/ui";
import { abhaService } from "@/services/abha.service";

const digitsOnly = (v: string) => v.replace(/\D/g, "");

/**
 * Change the patient's own ABHA while their verification is live: a new
 * mobile (OTP to that mobile) or an email (ABDM sends a link to confirm).
 */
export function AbhaAccountUpdate({ verificationId }: { verificationId: string }) {
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [email, setEmail] = useState("");
  const [otpSent, setOtpSent] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const sendOtp = useMutation({
    mutationFn: () => abhaService.requestMobileChange(verificationId, mobile),
    onSuccess: (r) => setOtpSent(r.message ?? "OTP sent to the new mobile."),
  });
  const verify = useMutation({
    mutationFn: () => abhaService.verifyMobileChange(verificationId, otp),
    onSuccess: (r) => {
      setDone(r.message ?? "The ABHA's mobile is changed.");
      setOtpSent(null);
      setOtp("");
    },
  });
  const link = useMutation({
    mutationFn: () => abhaService.requestEmailLink(verificationId, email),
    onSuccess: (r) => setDone(r.message ?? "ABDM has emailed a verification link."),
  });
  const failure = [sendOtp, verify, link].find((m) => m.isError)?.error;

  return (
    <Stack gap="sm">
      <Text size="sm" fw={600}>
        Update the patient's ABHA
      </Text>
      {failure && (
        <Alert tone="danger" title="ABDM said no">
          {failure.message}
        </Alert>
      )}
      {done && (
        <Alert tone="success" title="Done">
          {done}
        </Alert>
      )}
      <Group align="flex-end" wrap="nowrap">
        <Input
          label="New mobile"
          inputMode="numeric"
          value={mobile}
          onChange={(e) => setMobile(digitsOnly(e.currentTarget.value).slice(0, 10))}
        />
        <Button
          tone="secondary"
          disabled={mobile.length !== 10}
          loading={sendOtp.isPending}
          onClick={() => sendOtp.mutate()}
        >
          Send OTP
        </Button>
      </Group>
      {otpSent && (
        <Group align="flex-end" wrap="nowrap">
          <Input
            label={otpSent}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(digitsOnly(e.currentTarget.value))}
          />
          <Button
            tone="primary"
            disabled={otp.length !== 6}
            loading={verify.isPending}
            onClick={() => verify.mutate()}
          >
            Change mobile
          </Button>
        </Group>
      )}
      <Group align="flex-end" wrap="nowrap">
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.currentTarget.value.trim())}
        />
        <Button
          tone="secondary"
          disabled={!email.includes("@")}
          loading={link.isPending}
          onClick={() => link.mutate()}
        >
          Send verification link
        </Button>
      </Group>
    </Stack>
  );
}
