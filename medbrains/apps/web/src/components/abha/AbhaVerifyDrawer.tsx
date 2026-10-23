import { Radio, Stack, Text } from "@mantine/core";
import type { AbhaOtpVia, AbhaVerificationStep, AbhaVerifyMethod } from "@medbrains/types";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useInterval } from "react-use";
import { Alert, Button, Input, Modal, SegmentedControl } from "@/components/ui";
import { abhaService } from "@/services/abha.service";
import { type AbhaConfirmProps, AbhaVerifiedStep } from "./AbhaVerifiedStep";
import { ResendOtpButton } from "./ResendOtpButton";

interface AbhaVerifyDrawerProps extends AbhaConfirmProps {
  opened: boolean;
  onClose: () => void;
}

/**
 * "Verify ABHA": find the person's ABHA, they read out the OTP ABDM sends them,
 * staff compare ABHA's details with ours and choose what to keep.
 */
export function AbhaVerifyDrawer(props: AbhaVerifyDrawerProps) {
  return (
    <Modal opened={props.opened} onClose={props.onClose} title="Verify ABHA" fullScreen>
      {/* Remounting on open starts every verification fresh. */}
      {props.opened && <VerifyFlow {...props} />}
    </Modal>
  );
}

function VerifyFlow({ ours, confirmLabel, confirming, onConfirm }: AbhaVerifyDrawerProps) {
  const [method, setMethod] = useState<AbhaVerifyMethod>("abha_number");
  const [via, setVia] = useState<AbhaOtpVia>("aadhaar");
  const [value, setValue] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<AbhaVerificationStep | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [wait, setWait] = useState(0);
  useInterval(() => setWait((w) => w - 1), wait > 0 ? 1000 : null);

  const advance = (next: AbhaVerificationStep) => {
    setStep(next);
    setWait(next.resend_after_seconds ?? 0);
  };
  const start = useMutation({
    mutationFn: () =>
      abhaService.start({ method, value, otp_via: method === "mobile" ? undefined : via }),
    onSuccess: advance,
  });
  const resend = useMutation({
    mutationFn: (id: string) => abhaService.resend(id),
    onSuccess: advance,
  });
  const verify = useMutation({
    mutationFn: (id: string) => abhaService.submitOtp(id, otp),
    onSuccess: (next) => {
      setOtp("");
      advance(next);
    },
  });
  const choose = useMutation({
    mutationFn: ({ id, number }: { id: string; number: string }) =>
      abhaService.chooseAccount(id, number),
    onSuccess: advance,
  });
  const failure = [start, resend, verify, choose].find((m) => m.isError)?.error;

  return (
    <Stack>
      {failure && (
        <Alert tone="danger" title="ABDM said no">
          {failure.message}
        </Alert>
      )}

      {!step && (
        <Stack>
          <SegmentedControl
            aria-label="Find the ABHA by"
            value={method}
            onChange={(v) => setMethod(v as AbhaVerifyMethod)}
            data={[
              { value: "abha_number", label: "ABHA number" },
              { value: "mobile", label: "Mobile number" },
              { value: "abha_address", label: "ABHA address" },
            ]}
          />
          <Input
            label={
              method === "abha_number"
                ? "ABHA number (14 digits)"
                : method === "mobile"
                  ? "Mobile number"
                  : "ABHA address (e.g. priya.v@abdm)"
            }
            inputMode={method === "abha_address" ? "text" : "numeric"}
            autoComplete="off"
            value={value}
            onChange={(e) => setValue(e.currentTarget.value)}
            data-autofocus
          />
          {method !== "mobile" && (
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
          )}
          <Button tone="primary" loading={start.isPending} onClick={() => start.mutate()}>
            Send OTP
          </Button>
        </Stack>
      )}

      {step?.stage === "otp_sent" && (
        <Stack>
          <Text size="sm">
            {step.message ?? "ABDM has sent the patient an OTP."} Ask them to read it out.
          </Text>
          <Input
            label="OTP"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.currentTarget.value.replace(/\D/g, ""))}
            data-autofocus
          />
          <Button
            tone="primary"
            disabled={otp.length !== 6}
            loading={verify.isPending}
            onClick={() => verify.mutate(step.id)}
          >
            Verify
          </Button>
          <ResendOtpButton
            wait={wait}
            resendsLeft={step.resends_left}
            loading={resend.isPending}
            onResend={() => resend.mutate(step.id)}
          />
        </Stack>
      )}

      {step?.stage === "choose_account" && (
        <Stack>
          <Radio.Group
            label="Several ABHAs use this mobile — which one is the patient's?"
            value={chosen}
            onChange={setChosen}
          >
            <Stack gap={8} mt={8}>
              {step.accounts.map((a) => (
                <Radio
                  key={a.abha_number}
                  value={a.abha_number}
                  label={`${a.name ?? "Unnamed"} · ${a.abha_number}`}
                  description={[a.abha_address, a.gender, a.year_of_birth]
                    .filter(Boolean)
                    .join(" · ")}
                />
              ))}
            </Stack>
          </Radio.Group>
          <Button
            tone="primary"
            disabled={!chosen}
            loading={choose.isPending}
            onClick={() => chosen && choose.mutate({ id: step.id, number: chosen })}
          >
            Continue
          </Button>
        </Stack>
      )}

      {step?.stage === "verified" && step.profile && (
        <AbhaVerifiedStep
          step={step}
          profile={step.profile}
          ours={ours}
          confirmLabel={confirmLabel}
          confirming={confirming}
          onConfirm={onConfirm}
        />
      )}
    </Stack>
  );
}
