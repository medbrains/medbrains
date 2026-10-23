import { FileInput, Group, Stack, Text } from "@mantine/core";
import type { AbhaVerificationStep } from "@medbrains/types";
import { IconPhoto } from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Button, Input } from "@/components/ui";
import { abhaService } from "@/services/abha.service";

/** The largest photo ABDM's card takes, as the server checks it. */
const MAX_PHOTO_BYTES = 1_000_000;

const digitsOnly = (v: string) => v.replace(/\D/g, "");

/** A file's bytes as base64, without the `data:` prefix. */
const toBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",").pop() ?? "");
    reader.onerror = () => reject(new Error("The photo could not be read."));
    reader.readAsDataURL(file);
  });

interface AbhaProfileActionsProps {
  verificationId: string;
  /** The profile read again after a re-KYC. */
  onStepChange?: (step: AbhaVerificationStep) => void;
}

/**
 * Re-KYC (PROF_ABHA_604: refresh the ABHA's details from Aadhaar, by an OTP
 * to the Aadhaar mobile) and a new photo (PROF_ABHA_602).
 */
export function AbhaProfileActions({ verificationId, onStepChange }: AbhaProfileActionsProps) {
  const [otpSent, setOtpSent] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const sendOtp = useMutation({
    mutationFn: () => abhaService.requestReKyc(verificationId),
    onSuccess: (r) => setOtpSent(r.message ?? "OTP sent to the Aadhaar mobile."),
  });
  const verify = useMutation({
    mutationFn: () => abhaService.verifyReKyc(verificationId, otp),
    onSuccess: (step) => {
      setOtpSent(null);
      setOtp("");
      setDone(step.message ?? "The ABHA's KYC is refreshed from Aadhaar.");
      onStepChange?.(step);
    },
  });
  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (file.size > MAX_PHOTO_BYTES) throw new Error("Choose a photo under 1 MB.");
      return abhaService.updatePhoto(verificationId, await toBase64(file));
    },
    onSuccess: (r) => {
      setPhoto(null);
      setDone(r.message ?? "The photo on the ABHA is changed.");
    },
  });
  const failure = [sendOtp, verify, upload].find((m) => m.isError)?.error;

  return (
    <Stack gap="sm">
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
        <Text size="sm" flex={1}>
          Refresh the ABHA's name, birth date and address from Aadhaar.
        </Text>
        <Button tone="secondary" loading={sendOtp.isPending} onClick={() => sendOtp.mutate()}>
          Re-KYC
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
            Confirm re-KYC
          </Button>
        </Group>
      )}
      <Group align="flex-end" wrap="nowrap">
        <FileInput
          label="New photo on the ABHA"
          description="JPEG or PNG, under 1 MB"
          accept="image/jpeg,image/png"
          leftSection={<IconPhoto size={16} />}
          value={photo}
          onChange={setPhoto}
          clearable
          flex={1}
        />
        <Button
          tone="secondary"
          disabled={!photo}
          loading={upload.isPending}
          onClick={() => photo && upload.mutate(photo)}
        >
          Change photo
        </Button>
      </Group>
    </Stack>
  );
}
