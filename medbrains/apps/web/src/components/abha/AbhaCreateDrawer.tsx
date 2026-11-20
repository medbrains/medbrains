import { Group, Stack, Text } from "@mantine/core";
import type { AbhaVerificationStep } from "@medbrains/types";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Button, Checkbox, Input, Modal, PasswordField } from "@/components/ui";
import { abhaService } from "@/services/abha.service";
import { AbhaAddressStep } from "./AbhaAddressStep";
import { AbhaFailureAlert } from "./AbhaFailureAlert";
import { type AbhaConfirmProps, AbhaVerifiedStep } from "./AbhaVerifiedStep";
import {
  ABHA_ENROL_CONSENT,
  ABHA_ENROL_CONSENT_TITLE,
  ABHA_ENROL_CONSENT_VERSION,
} from "./abhaConsent";
import { aadhaarFieldError, isValidAadhaar, isValidMobile, mobileFieldError } from "./abhaRules";
import { OtpSentTo } from "./OtpSentTo";
import { ResendOtpButton } from "./ResendOtpButton";
import { useResendWait } from "./useResendWait";

interface AbhaCreateDrawerProps extends AbhaConfirmProps {
  opened: boolean;
  onClose: () => void;
  /** The mobile on the registration form, offered for the ABHA. */
  mobile?: string;
}

/**
 * "Create ABHA" with the patient's Aadhaar: consent, Aadhaar OTP, the mobile
 * for the ABHA (with its own OTP if it is not the Aadhaar-linked one), then an
 * ABHA address. If they already have an ABHA, ABDM returns that one.
 */
export function AbhaCreateDrawer(props: AbhaCreateDrawerProps) {
  return (
    <Modal opened={props.opened} onClose={props.onClose} title="Create ABHA" fullScreen>
      {/* Remounting on open forgets the Aadhaar number typed last time. */}
      {props.opened && <CreateFlow {...props} />}
    </Modal>
  );
}

const digitsOnly = (v: string) => v.replace(/\D/g, "");

function CreateFlow({ mobile: formMobile, ...confirm }: AbhaCreateDrawerProps) {
  const [consent, setConsent] = useState(false);
  const [aadhaar, setAadhaar] = useState("");
  const [tried, setTried] = useState(false);
  const [otp, setOtp] = useState("");
  const [mobile, setMobile] = useState(digitsOnly(formMobile ?? "").slice(-10));
  const [step, setStep] = useState<AbhaVerificationStep | null>(null);
  const [wait, setWait] = useResendWait();

  const advance = (next: AbhaVerificationStep) => {
    setOtp("");
    // The Aadhaar number is not needed past the first OTP; drop it.
    if (next.stage !== "otp_sent") setAadhaar("");
    setStep(next);
    setWait(next.resend_after_seconds ?? 0);
  };
  const start = useMutation({
    mutationFn: () => abhaService.startEnrolment({ aadhaar, consent }),
    onSuccess: advance,
  });
  const aadhaarOtp = useMutation({
    mutationFn: (id: string) => abhaService.enrolmentOtp(id, otp, mobile),
    onSuccess: advance,
  });
  const resend = useMutation({
    // The Aadhaar OTP goes to the Aadhaar again, so it is sent with it.
    mutationFn: (current: AbhaVerificationStep) =>
      abhaService.resendEnrolment(current.id, current.stage === "otp_sent" ? aadhaar : undefined),
    onSuccess: advance,
  });
  const mobileOtp = useMutation({
    mutationFn: (id: string) => abhaService.enrolmentMobileOtp(id, otp),
    onSuccess: advance,
  });
  const failure = [start, resend, aadhaarOtp, mobileOtp].find((m) => m.isError)?.error;
  const aadhaarError = aadhaarFieldError(aadhaar, tried);
  const mobileError = mobileFieldError(mobile);

  const otpInput = (
    <Input
      label="OTP"
      inputMode="numeric"
      autoComplete="one-time-code"
      maxLength={6}
      value={otp}
      onChange={(e) => setOtp(digitsOnly(e.currentTarget.value))}
      data-autofocus
    />
  );

  return (
    <Stack>
      {failure && <AbhaFailureAlert error={failure} />}

      {!step && (
        <Stack>
          <Alert tone="info" title={`${ABHA_ENROL_CONSENT_TITLE} — read these to the patient`}>
            {ABHA_ENROL_CONSENT}
          </Alert>
          <Checkbox
            label={`I agree — the patient consents to creating their ABHA with Aadhaar (ABDM consent v${ABHA_ENROL_CONSENT_VERSION})`}
            checked={consent}
            onChange={(e) => setConsent(e.currentTarget.checked)}
          />
          <PasswordField
            label="Aadhaar number"
            description="12 digits. Sent to ABDM encrypted; not saved here."
            inputMode="numeric"
            autoComplete="off"
            value={aadhaar}
            error={aadhaarError}
            onChange={(e) => setAadhaar(digitsOnly(e.currentTarget.value).slice(0, 12))}
          />
          <Button
            tone="primary"
            disabled={!consent}
            loading={start.isPending}
            onClick={() => {
              // CRT_ABHA_104: an invalid number is refused here; no OTP is asked for.
              setTried(true);
              if (isValidAadhaar(aadhaar)) start.mutate();
            }}
          >
            Send OTP to the Aadhaar mobile
          </Button>
        </Stack>
      )}

      {step?.stage === "otp_sent" && (
        <Stack>
          <Text size="sm">{step.message ?? "ABDM has sent an OTP to the Aadhaar mobile."}</Text>
          <OtpSentTo to={step.sent_to} />
          {otpInput}
          <Input
            label="Mobile for the ABHA"
            description="If this is not the Aadhaar-linked mobile, it gets its own OTP next."
            inputMode="numeric"
            value={mobile}
            error={mobileError}
            onChange={(e) => setMobile(digitsOnly(e.currentTarget.value).slice(0, 10))}
          />
          <Group>
            <Button
              tone="primary"
              disabled={otp.length !== 6 || !isValidMobile(mobile)}
              loading={aadhaarOtp.isPending}
              onClick={() => aadhaarOtp.mutate(step.id)}
            >
              Create ABHA
            </Button>
          </Group>
          <ResendOtpButton
            wait={wait}
            resendsLeft={step.resends_left}
            loading={resend.isPending}
            onResend={() => resend.mutate(step)}
          />
        </Stack>
      )}

      {step?.stage === "mobile_otp_sent" && (
        <Stack>
          <Text size="sm">{step.message ?? "ABDM has sent an OTP to the new mobile."}</Text>
          <OtpSentTo to={step.sent_to} />
          {otpInput}
          <Button
            tone="primary"
            disabled={otp.length !== 6}
            loading={mobileOtp.isPending}
            onClick={() => mobileOtp.mutate(step.id)}
          >
            Verify mobile
          </Button>
          <ResendOtpButton
            wait={wait}
            resendsLeft={step.resends_left}
            loading={resend.isPending}
            onResend={() => resend.mutate(step)}
          />
        </Stack>
      )}

      {step?.stage === "choose_address" && <AbhaAddressStep step={step} onDone={advance} />}

      {step?.stage === "verified" && step.profile && (
        <AbhaVerifiedStep step={step} profile={step.profile} {...confirm} />
      )}
    </Stack>
  );
}
