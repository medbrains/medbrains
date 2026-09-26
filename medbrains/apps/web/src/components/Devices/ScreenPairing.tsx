import { Box, Stack, Text } from "@mantine/core";
import { ApiError, api } from "@medbrains/api";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffectOnce } from "react-use";
import { Alert } from "@/components/ui";
import { Clock } from "@/pages/token-display";
import styles from "@/pages/token-display.module.scss";

interface ScreenPairingProps {
  /** Called with the screen's credential once an administrator approves it. */
  onPaired: (token: string) => void;
}

/**
 * The screen's side of pairing: a code big enough to read from across a
 * room, and a wait for an administrator to approve it. A code that expires or
 * is refused is replaced by a new one — nobody has to touch the TV.
 */
export function ScreenPairing({ onPaired }: ScreenPairingProps) {
  const code = useMutation({
    mutationFn: () => api.requestDeviceCode({ app_variant: "tv", label: "Waiting-room screen" }),
  });
  useEffectOnce(() => code.mutate());

  const deviceCode = code.data?.device_code;
  useQuery({
    queryKey: ["screen-pairing", deviceCode],
    queryFn: async () => {
      const answer = await api.pollDeviceToken({ device_code: deviceCode ?? "" });
      if (answer.status === "approved" && answer.jwt) onPaired(answer.jwt);
      if (answer.status === "expired" || answer.status === "denied") code.mutate();
      return answer;
    },
    enabled: Boolean(deviceCode),
    refetchInterval: (code.data?.poll_interval_seconds ?? 5) * 1000,
  });

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
        {code.data && (
          <Text ff="monospace" fw={700} fz="4rem" data-testid="screen-pairing-code">
            {code.data.user_code}
          </Text>
        )}
        <Text size="lg" maw={640}>
          An administrator opens Admin → Paired devices on a computer, finds this code under
          “Screens waiting to be paired” and chooses the department it shows.
        </Text>
        {code.isError && (
          <Alert tone="danger">
            {code.error instanceof ApiError
              ? `The hospital refused this screen: ${code.error.message}`
              : "Cannot reach the hospital. Check this screen's network."}
          </Alert>
        )}
      </Stack>
    </Box>
  );
}
