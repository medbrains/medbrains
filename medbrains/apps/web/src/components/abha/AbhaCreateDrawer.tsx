import { Group, Stack, Text } from "@mantine/core";
import type { AbhaVerificationStep } from "@medbrains/types";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useInterval } from "react-use";
import {
  Alert,
  Button,
  Checkbox,
  Chip,
  ChipGroup,
  Input,
  Modal,
  PasswordField,
} from "@/components/ui";
import { abhaService } from "@/services/abha.service";
import { AbhaAddressRules } from "./AbhaAddressRules";
import { AbhaFailureAlert } from "./AbhaFailureAlert";
import { type AbhaConfirmProps, AbhaVerifiedStep } from "./AbhaVerifiedStep";
import {
  ABHA_ENROL_CONSENT,
  ABHA_ENROL_CONSENT_TITLE,
  ABHA_ENROL_CONSENT_VERSION,
} from "./abhaConsent";
import {
  ABHA_MESSAGES,
  addressName,
  isValidAadhaar,
  isValidAddress,
  isValidMobile,
} from "./abhaRules";
import { ResendOtpButton } from "./ResendOtpButton";

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
  const [address, setAddress] = useState("");
  const [step, setStep] = useState<AbhaVerificationStep | null>(null);
  const [wait, setWait] = useState(0);
  useInterval(() => setWait((w) => w - 1), wait > 0 ? 1000 : null);

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
  const choose = useMutation({
    mutationFn: (id: string) => abhaService.chooseAddress(id, address),
    onSuccess: advance,
  });
  const keep = useMutation({
    mutationFn: (id: string) => abhaService.chooseAddress(id, "", true),
    onSuccess: advance,
  });
  // CRT_ABHA_112: a taken address is a choice for the desk, not a failure.
  const taken = choose.error?.message === ABHA_MESSAGES.addressTaken;
  const failure = [start, resend, aadhaarOtp, mobileOtp, keep, choose]
    .filter((m) => !(m === choose && taken))
    .find((m) => m.isError)?.error;
  const aadhaarError =
    (tried || aadhaar.length === 12) && !isValidAadhaar(aadhaar)
      ? ABHA_MESSAGES.aadhaarInvalid
      : undefined;
  const mobileError = mobile && !isValidMobile(mobile) ? ABHA_MESSAGES.mobileInvalid : undefined;
  const domain = step?.address_domain ?? "abdm";
  const addressValid = isValidAddress(addressName(address, domain), domain);
  const sentTo = step?.sent_to && (
    <Text size="sm" ff="monospace">
      OTP sent to {step.sent_to}
    </Text>
  );

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
          {sentTo}
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
          {sentTo}
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

      {step?.stage === "choose_address" && (
        <Stack>
          <Text size="sm" fw={600}>
            Choose an ABHA address — the patient's easy-to-remember health ID
          </Text>
          {step.suggestions.length > 0 && (
            <ChipGroup
              value={address}
              onChange={(v) => {
                setAddress(String(v));
                choose.reset();
              }}
            >
              <Group gap="xs">
                {step.suggestions.map((s) => (
                  <Chip key={s} value={s}>
                    {s}
                  </Chip>
                ))}
              </Group>
            </ChipGroup>
          )}
          <Input
            label="Or type one"
            description={`ABDM adds @${domain}.`}
            value={address}
            onChange={(e) => {
              setAddress(e.currentTarget.value.trim());
              choose.reset();
            }}
          />
          <AbhaAddressRules name={addressName(address, domain)} domain={domain} />
          {taken ? (
            <Alert tone="warning" title={ABHA_MESSAGES.addressTaken}>
              <Group mt="xs">
                <Button
                  tone="primary"
                  loading={keep.isPending}
                  onClick={() => keep.mutate(step.id)}
                >
                  Proceed with the existing ABHA address
                </Button>
                <Button
                  tone="secondary"
                  onClick={() => {
                    choose.reset();
                    setAddress("");
                  }}
                >
                  Create a new ABHA address
                </Button>
              </Group>
            </Alert>
          ) : (
            <Button
              tone="primary"
              disabled={!addressValid}
              loading={choose.isPending}
              onClick={() => choose.mutate(step.id)}
            >
              Create ABHA address
            </Button>
          )}
        </Stack>
      )}

      {step?.stage === "verified" && step.profile && (
        <AbhaVerifiedStep step={step} profile={step.profile} {...confirm} />
      )}
    </Stack>
  );
}
