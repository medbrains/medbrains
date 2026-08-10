/**
 * Self-check-in kiosk.
 *
 * `POST /api/public/kiosk/checkin` has existed with nothing calling it. A
 * patient scans the QR on their appointment slip and the kiosk checks them in,
 * issues their token, and hands back an opaque handle they can keep on their
 * phone to follow it.
 *
 * Built to the kiosk rules rather than the web ones: one linear flow, no
 * navigation, targets far above the 44px minimum, and text large enough to read
 * standing up. The scan input is a plain field because hospital kiosks use HID
 * barcode readers that behave like keyboards — no camera permission, and it
 * works with a wedge scanner bolted to the enclosure.
 *
 * The behaviour that matters most is the one nobody sees: the screen clears
 * itself. The next person to stand here is a stranger.
 */

import { Box, Loader, Stack, Text, TextInput, Title } from "@mantine/core";
import type { KioskCheckinResult } from "@medbrains/types";
import { useMutation } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Button } from "@/components/ui";
import { appointmentsService } from "@/services/appointments.service";
import {
  IDLE_INPUT_TIMEOUT_MS,
  isScannable,
  type KioskStage,
  normaliseScan,
  RESULT_TIMEOUT_MS,
} from "./kiosk-session";

export function KioskSelfCheckinPage() {
  const [scan, setScan] = useState("");
  const [stage, setStage] = useState<KioskStage>("waiting");
  const [result, setResult] = useState<KioskCheckinResult | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setScan("");
    setResult(null);
    setFailure(null);
    setStage("waiting");
    inputRef.current?.focus();
  }, []);

  const checkin = useMutation({
    mutationFn: (qrData: string) => appointmentsService.publicKioskCheckin({ qr_data: qrData }),
    onSuccess: (data) => {
      setResult(data);
      setStage("done");
    },
    onError: (error: Error) => {
      setFailure(error.message);
      setStage("failed");
    },
  });

  /**
   * The kiosk clears itself.
   *
   * A result left on screen shows the next person in the queue somebody else's
   * name, doctor and token. A failure is no safer: the message can name the
   * appointment date, which says that whoever holds that code was here.
   *
   * An abandoned half-typed entry is cleared on a longer timer — a partial
   * identifier is still an identifier.
   */
  useEffect(() => {
    const holdsDetail = stage === "done" || stage === "failed";
    const delay = holdsDetail ? RESULT_TIMEOUT_MS : IDLE_INPUT_TIMEOUT_MS;
    if (!holdsDetail && scan.trim() === "") {
      return;
    }
    const timer = window.setTimeout(reset, delay);
    return () => window.clearTimeout(timer);
  }, [stage, scan, reset]);

  // The field must be ready for the next scan without anyone tapping it.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = (raw: string) => {
    const code = normaliseScan(raw);
    if (!isScannable(code)) {
      return;
    }
    setStage("checking");
    checkin.mutate(code);
  };

  if (stage === "checking") {
    return (
      <KioskFrame>
        <Loader size="xl" />
        <Text size="xl">Checking you in…</Text>
      </KioskFrame>
    );
  }

  if (stage === "done" && result) {
    return (
      <KioskFrame>
        <Text size="xl" c="dimmed">
          You are checked in
        </Text>
        <Text style={{ fontSize: 96, fontWeight: 800, lineHeight: 1 }}>{result.token_number}</Text>
        <Text size="xl">
          {result.department_name} · {result.doctor_name}
        </Text>
        <Box style={{ background: "white", padding: 16 }}>
          <QRCodeSVG
            value={`${window.location.origin}/queue/${result.status_token}`}
            size={160}
            level="M"
            role="img"
            aria-label="Scan to follow your token on your phone"
          />
        </Box>
        <Text size="lg">Scan this to follow your token on your phone</Text>
        <Button tone="primary" size="xl" onClick={reset}>
          Done
        </Button>
        <Text size="sm" c="dimmed">
          This screen clears itself shortly.
        </Text>
      </KioskFrame>
    );
  }

  if (stage === "failed") {
    return (
      <KioskFrame>
        <Alert tone="danger" title="We could not check you in">
          <Text size="lg">{failure ?? "Please see the reception desk."}</Text>
        </Alert>
        <Text size="lg">Please go to the reception desk and they will help you.</Text>
        <Button tone="primary" size="xl" onClick={reset}>
          Try again
        </Button>
      </KioskFrame>
    );
  }

  return (
    <KioskFrame>
      <Title order={1} style={{ fontSize: 48 }}>
        Check in for your appointment
      </Title>
      <Text size="xl">Hold the QR code on your appointment slip under the scanner.</Text>
      <TextInput
        ref={inputRef}
        value={scan}
        onChange={(event) => setScan(event.currentTarget.value)}
        onKeyDown={(event) => {
          // A wedge scanner sends the payload then Enter.
          if (event.key === "Enter") {
            submit(scan);
          }
        }}
        size="xl"
        w="100%"
        maw={640}
        aria-label="Appointment code"
        placeholder="Or type your appointment code"
        styles={{ input: { fontSize: 28, height: 72 } }}
      />
      <Button tone="primary" size="xl" onClick={() => submit(scan)} disabled={!isScannable(scan)}>
        Check in
      </Button>
    </KioskFrame>
  );
}

/**
 * One centred column, high contrast, nothing to navigate to. A kiosk has no
 * back button because there is nowhere else to be.
 */
function KioskFrame({ children }: { children: React.ReactNode }) {
  return (
    <Stack
      align="center"
      justify="center"
      gap="xl"
      p="xl"
      style={{ minHeight: "100vh", textAlign: "center" }}
    >
      {children}
    </Stack>
  );
}
