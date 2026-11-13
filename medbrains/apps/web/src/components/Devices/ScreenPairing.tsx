import { Box, Group, Stack, Text } from "@mantine/core";
import { ApiError, api } from "@medbrains/api";
import { useMutation, useQuery } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { useEffectOnce } from "react-use";
import { Alert, Button, Input } from "@/components/ui";
import { Clock } from "@/pages/token-display";
import styles from "@/pages/token-display.module.scss";

interface ScreenPairingProps {
  /** Called with the screen's credential once an administrator approves it. */
  onPaired: (token: string) => void;
}

/** The hospital code in the address the screen was opened at (`/screen?hospital=CODE`). */
function hospitalFromAddress(): string | null {
  return new URLSearchParams(window.location.search).get("hospital")?.trim() || null;
}

/** Keeps a typed hospital code in the address, so a reload does not ask for it again. */
function rememberHospital(hospital: string): void {
  window.history.replaceState(null, "", `?hospital=${encodeURIComponent(hospital)}`);
}

interface HospitalFormProps {
  onSubmit: (hospital: string) => void;
  refused: boolean;
}

/** Asks for the hospital's code when the address did not carry one. */
function HospitalForm({ onSubmit, refused }: HospitalFormProps) {
  const [typed, setTyped] = useState("");
  /** Hands the typed code on, without the page reloading for the form. */
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (typed.trim()) onSubmit(typed.trim());
  };
  return (
    <Box component="form" onSubmit={submit} maw={480} w="100%">
      <Stack gap="md">
        {refused && <Alert tone="danger">No hospital has that code. Check it and try again.</Alert>}
        <Input
          label="Hospital code"
          description="Shown on Admin → Paired devices, next to the address of this page"
          value={typed}
          onChange={(event) => setTyped(event.currentTarget.value)}
          autoComplete="off"
          size="lg"
          required
          data-autofocus
        />
        <Button tone="primary" type="submit" size="lg" disabled={!typed.trim()}>
          Continue
        </Button>
      </Stack>
    </Box>
  );
}

/**
 * The screen's side of pairing: a reference and a code big enough to read
 * from across a room, and a wait for an administrator to approve it. The
 * request names the hospital, from the address or typed once. A code that
 * expires or is refused is replaced by a new one — nobody has to touch the TV.
 */
export function ScreenPairing({ onPaired }: ScreenPairingProps) {
  const [hospital, setHospital] = useState(hospitalFromAddress);
  const code = useMutation({
    mutationFn: (hospitalCode: string) =>
      api.requestDeviceCode({
        hospital_code: hospitalCode,
        app_variant: "tv",
      }),
  });
  useEffectOnce(() => {
    if (hospital) code.mutate(hospital);
  });
  /** Asks the named hospital for a code, and keeps its name in the address. */
  const askFor = (hospitalCode: string) => {
    rememberHospital(hospitalCode);
    setHospital(hospitalCode);
    code.mutate(hospitalCode);
  };

  const deviceCode = code.data?.device_code;
  useQuery({
    queryKey: ["screen-pairing", deviceCode],
    queryFn: async () => {
      const answer = await api.pollDeviceToken({ device_code: deviceCode ?? "" });
      if (answer.status === "approved" && answer.jwt) onPaired(answer.jwt);
      if ((answer.status === "expired" || answer.status === "denied") && hospital) {
        code.mutate(hospital);
      }
      return answer;
    },
    enabled: Boolean(deviceCode),
    refetchInterval: (code.data?.poll_interval_seconds ?? 5) * 1000,
  });
  const unknownHospital = code.error instanceof ApiError && code.error.status === 400;

  return (
    <Box className={styles.display}>
      <Box className={styles.bar}>
        <Text className={styles.brand}>MedBrains · Screen</Text>
        <Clock />
      </Box>
      <Stack align="center" justify="center" gap="lg" className={styles.board} ta="center">
        <Text size="xl" fw={600}>
          This screen is not showing a queue yet
        </Text>
        {(!hospital || unknownHospital) && (
          <HospitalForm onSubmit={askFor} refused={unknownHospital} />
        )}
        {code.data && (
          <Stack gap="xs" align="center">
            <Text size="lg" ff="monospace" data-testid="screen-pairing-ref">
              Screen {code.data.reference}
            </Text>
            <Text ff="monospace" fw={700} fz="4rem" data-testid="screen-pairing-code">
              {code.data.user_code}
            </Text>
          </Stack>
        )}
        {code.data && (
          <Text size="lg" maw={640}>
            An administrator opens Admin → Paired devices on a computer, finds Screen{" "}
            {code.data.reference} under “Screens waiting to be paired”, types this code and chooses
            the department it shows.
          </Text>
        )}
        {code.isError && !unknownHospital && (
          <Group justify="center">
            <Alert tone="danger">
              {code.error instanceof ApiError
                ? `The hospital refused this screen: ${code.error.message}`
                : "Cannot reach the hospital. Check this screen's network."}
            </Alert>
            {hospital && (
              <Button tone="secondary" onClick={() => code.mutate(hospital)}>
                Try again
              </Button>
            )}
          </Group>
        )}
      </Stack>
    </Box>
  );
}
