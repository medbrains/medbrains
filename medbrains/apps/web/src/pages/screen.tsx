import { Box, Stack, Text } from "@mantine/core";
import { ApiError, api, clearNativeAuthTokens, setNativeAuthSession } from "@medbrains/api";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { BOARDS } from "@/components/Devices/PendingScreensCard";
import { ScreenPairing } from "@/components/Devices/ScreenPairing";
import { TokenBoardLive } from "@/components/TokenBoardLive";
import { Alert, Button } from "@/components/ui";
import { Clock } from "./token-display";
import styles from "./token-display.module.scss";

/** Where this screen keeps its own credential — a device's, not a person's. */
const SCREEN_KEY = "medbrains.screen.token";

/**
 * Whether the hospital refused this screen's credential (revoked, deleted,
 * or no longer allowed) — as opposed to the network being down, when the
 * board keeps showing what it last knew. A 401 surfaces as `session_expired`.
 */
function isRefused(error: unknown): boolean {
  if (error instanceof ApiError) return [401, 403, 404].includes(error.status);
  return error instanceof Error && error.message === "session_expired";
}

function readStored(): string | null {
  try {
    return window.localStorage.getItem(SCREEN_KEY);
  } catch {
    return null;
  }
}

function store(token: string | null): void {
  try {
    if (token) window.localStorage.setItem(SCREEN_KEY, token);
    else window.localStorage.removeItem(SCREEN_KEY);
  } catch {
    // A hardened kiosk browser may refuse storage; the screen then re-pairs
    // after a reload, which is safer than failing to show the board.
  }
  if (token) setNativeAuthSession(token);
  else clearNativeAuthTokens();
}

/**
 * A waiting-room screen (RFCs/modules/RFC-MODULE-token-queues.md, P3b).
 *
 * Opened on a TV with nobody signed in, it shows a code for an administrator
 * to approve, then its own board — the department and board it was paired
 * for — with no keyboard and no staff login on a public device.
 */
export function ScreenPage() {
  const [token, setToken] = useState<string | null>(() => {
    const stored = readStored();
    if (stored) setNativeAuthSession(stored);
    return stored;
  });
  const pair = (next: string | null) => {
    store(next);
    setToken(next);
  };

  const board = useQuery({
    queryKey: ["device-board", token],
    queryFn: async () => {
      try {
        return await api.getDeviceBoard();
      } catch (error) {
        // A refused credential is dropped at once, so pairing starts clean.
        if (isRefused(error)) store(null);
        throw error;
      }
    },
    enabled: Boolean(token),
    retry: false,
    // Re-read, so a screen moved to another department follows without a visit.
    refetchInterval: 60_000,
  });

  // Revoked, or paired to a hospital that no longer knows it: start again
  // rather than leave a dead screen on the wall.
  const refused = isRefused(board.error);
  if (!token || refused) {
    return <ScreenPairing onPaired={pair} />;
  }

  const bound = board.data?.module && board.data.department_id ? board.data : null;
  const boardLabel = BOARDS.find((b) => b.value === bound?.module)?.label ?? bound?.module;
  return (
    <Box className={styles.display}>
      <Box className={styles.bar}>
        <Text className={styles.brand}>
          {bound ? `${boardLabel} · ${bound.department_name ?? ""}` : "MedBrains · Screen"}
        </Text>
        <Clock />
      </Box>
      <Box className={styles.board}>
        {board.isError && !refused && (
          <Alert tone="warning">
            Connection to the hospital is lost — showing the last known queue.
          </Alert>
        )}
        {board.isSuccess && !bound && (
          <Stack align="center" gap="md" mt="xl">
            <Alert tone="info">
              This screen is paired but not given a board. Ask an administrator to pair it again.
            </Alert>
            <Button tone="secondary" onClick={() => pair(null)}>
              Pair again
            </Button>
          </Stack>
        )}
        {bound?.module && bound.department_id && (
          <TokenBoardLive
            title={`${boardLabel} · ${bound.department_name ?? ""}`}
            module={bound.module}
            scope="department"
            scopeId={bound.department_id}
            publicMode
            display
          />
        )}
      </Box>
    </Box>
  );
}
