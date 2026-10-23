import { Radio, Stack, Text } from "@mantine/core";
import type {
  AbhaCardQr,
  AbhaOtpVia,
  AbhaVerificationStep,
  AbhaVerifyMethod,
} from "@medbrains/types";
import { IconQrcode } from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useInterval } from "react-use";
import { Alert, Button, Input, Modal, PasswordField, Select } from "@/components/ui";
import { abhaService } from "@/services/abha.service";
import { AbhaQrScanModal } from "./AbhaQrScanModal";
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

const METHODS: { value: AbhaVerifyMethod; label: string }[] = [
  { value: "abha_number", label: "ABHA number" },
  { value: "mobile", label: "Mobile number (OTP first)" },
  { value: "find_mobile", label: "Find by mobile (list the ABHAs first)" },
  { value: "aadhaar", label: "Aadhaar number" },
  { value: "abha_address", label: "ABHA address" },
];

const VALUE_LABEL: Record<AbhaVerifyMethod, string> = {
  abha_number: "ABHA number (14 digits)",
  mobile: "Mobile number",
  find_mobile: "Mobile number",
  aadhaar: "Aadhaar number",
  abha_address: "ABHA address (e.g. priya.v@abdm)",
};

/** Methods whose OTP can go to the Aadhaar mobile or the ABHA's own. */
const choosesVia = (m: AbhaVerifyMethod) => m === "abha_number" || m === "abha_address";

const digitsOnly = (v: string) => v.replace(/\D/g, "");

function VerifyFlow({ ours, confirmLabel, confirming, onConfirm }: AbhaVerifyDrawerProps) {
  const [method, setMethod] = useState<AbhaVerifyMethod>("abha_number");
  const [via, setVia] = useState<AbhaOtpVia>("aadhaar");
  const [value, setValue] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<AbhaVerificationStep | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [card, setCard] = useState<AbhaCardQr | null>(null);
  const [scanning, setScanning] = useState(false);
  const [closed, setClosed] = useState<string | null>(null);
  const [wait, setWait] = useState(0);
  useInterval(() => setWait((w) => w - 1), wait > 0 ? 1000 : null);

  const advance = (next: AbhaVerificationStep) => {
    setStep(next);
    setWait(next.resend_after_seconds ?? 0);
  };
  const start = useMutation({
    mutationFn: () =>
      abhaService.start({ method, value, otp_via: choosesVia(method) ? via : undefined }),
    onSuccess: advance,
  });
  const resend = useMutation({
    // An Aadhaar login sends the number again: the server never keeps it.
    mutationFn: (id: string) => abhaService.resend(id, method === "aadhaar" ? value : undefined),
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
  const readCard = (read: AbhaCardQr) => {
    setScanning(false);
    setCard(read);
    setMethod(read.abha_number ? "abha_number" : "abha_address");
    setValue(read.abha_number ?? read.abha_address ?? "");
  };

  if (closed) {
    return (
      <Alert tone="success" title="The ABHA is closed">
        {closed}
      </Alert>
    );
  }

  return (
    <Stack>
      {failure && (
        <Alert tone="danger" title="ABDM said no">
          {failure.message}
        </Alert>
      )}

      {!step && (
        <Stack>
          <Button
            tone="secondary"
            leftSection={<IconQrcode size={16} />}
            onClick={() => setScanning(true)}
          >
            Scan the ABHA card
          </Button>
          <AbhaQrScanModal opened={scanning} onClose={() => setScanning(false)} onRead={readCard} />
          {card && (
            <Alert tone="info" title="What the card says — verify it by OTP">
              {[card.name, card.gender, card.date_of_birth && `born ${card.date_of_birth}`]
                .filter(Boolean)
                .join(" · ") || "The card names an ABHA but no details."}
            </Alert>
          )}
          <Select
            label="Find the ABHA by"
            value={method}
            allowDeselect={false}
            onChange={(v) => v && setMethod(v as AbhaVerifyMethod)}
            data={METHODS}
          />
          {method === "aadhaar" ? (
            <PasswordField
              label={VALUE_LABEL.aadhaar}
              description="12 digits. Sent to ABDM encrypted; not saved here."
              inputMode="numeric"
              autoComplete="off"
              value={value}
              onChange={(e) => setValue(digitsOnly(e.currentTarget.value).slice(0, 12))}
              data-autofocus
            />
          ) : (
            <Input
              label={VALUE_LABEL[method]}
              inputMode={method === "abha_address" ? "text" : "numeric"}
              autoComplete="off"
              value={value}
              onChange={(e) => setValue(e.currentTarget.value)}
              data-autofocus
            />
          )}
          {method === "aadhaar" && (
            <Text size="sm" c="dimmed">
              ABDM sends the OTP to the mobile linked to the patient's Aadhaar.
            </Text>
          )}
          {choosesVia(method) && (
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
            {method === "find_mobile" ? "Find ABHAs" : "Send OTP"}
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

      {(step?.stage === "choose_account" || step?.stage === "search_results") && (
        <Stack>
          {step.message && <Text size="sm">{step.message}</Text>}
          <Radio.Group
            label={
              step.stage === "search_results"
                ? "Which ABHA is the patient's? ABDM sends the OTP to it."
                : "Several ABHAs use this mobile — which one is the patient's?"
            }
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
            {step.stage === "search_results" ? "Send OTP to this ABHA" : "Continue"}
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
          onStepChange={advance}
          onClosed={setClosed}
        />
      )}
    </Stack>
  );
}
