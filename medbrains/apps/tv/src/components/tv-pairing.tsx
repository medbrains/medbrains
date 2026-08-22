/**
 * How a display gets its credentials: it asks, and an administrator approves.
 *
 * The TV used to show a username and password form. That is wrong for this
 * surface twice over. Typing a password with a D-pad on an on-screen keyboard
 * is miserable, and it is a shared credential typed in a public corridor onto a
 * screen everybody can see — so in practice one staff login ends up pasted into
 * every display in the building and never rotated.
 *
 * The device-code flow is the same one a television uses to sign into a video
 * service: the display shows a short code, a person who is already
 * authenticated approves it from a workstation, and the display is handed its
 * own token. Nothing secret is ever shown on the screen — `user_code` only
 * identifies the request, and `device_code`, the secret that claims it, stays
 * in memory here and is never rendered.
 *
 * It is also what the authorization design already expects. `require_board_read`
 * accepts `display.board.read` only when the claims carry a `paired_device_id`,
 * which is precisely what an approved pairing mints. A display signed in as a
 * member of staff is borrowing a clinician's authority to show a corridor
 * board; a paired device has exactly the authority a board needs and can be
 * revoked on its own when the screen is retired.
 *
 * Every endpoint here already existed and nothing used them.
 */

import { api } from "@medbrains/api";
import { type SecretStore, useAuthStore } from "@medbrains/mobile-shell";
import { COLORS, OVERSCAN, SPACING } from "@medbrains/ui-mobile";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";

/** Fallback when the server does not say. Never poll faster than this. */
const DEFAULT_POLL_SECONDS = 5;
/** A floor, so a bad value cannot turn a display into a request flood. */
const MIN_POLL_SECONDS = 2;

type PairingPhase = "requesting" | "waiting" | "approved" | "denied" | "failed";

export interface TvPairingScreenProps {
  secretStore: SecretStore;
  /** Names the screen in the approval list, so an admin knows what they are approving. */
  label?: string;
}

export function TvPairingScreen({ secretStore, label = "Hospital display" }: TvPairingScreenProps) {
  const [phase, setPhase] = useState<PairingPhase>("requesting");
  const [userCode, setUserCode] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // The whole state machine lives in one effect, with its timer and its device
  // code as locals rather than refs. That is not tidiness: the three steps call
  // each other (a poll can ask for a new code, a failed request retries
  // itself), and as `useCallback`s that is a dependency cycle nothing can
  // express honestly. Closures make the cycle ordinary, and the cleanup below
  // is then provably complete -- one timer, cleared on the way out. A display
  // runs for months; a leaked poll outlives the screen that owned it.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    // Never in state: this is the secret that claims the approval, and state is
    // one careless render away from being displayed on a wall.
    let deviceCode: string | null = null;

    const schedule = (seconds: number, run: () => void) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(run, seconds * 1000);
    };

    const poll = async () => {
      if (!deviceCode) return;
      try {
        const response = await api.pollDeviceToken({ device_code: deviceCode });
        if (cancelled) return;
        if (response.status === "approved" && response.jwt) {
          const seated = await useAuthStore.getState().signInWithJwt(secretStore, response.jwt);
          if (cancelled) return;
          setPhase(seated ? "approved" : "failed");
          if (!seated) setMessage("The approval returned a token this display could not read.");
          return;
        }
        if (response.status === "denied") {
          setPhase("denied");
          setMessage("An administrator refused this display.");
          return;
        }
        if (response.status === "expired") {
          // Ask for a new one rather than stranding the screen on a dead code.
          void requestCode();
          return;
        }
        schedule(pollSeconds, () => void poll());
      } catch (error) {
        if (cancelled) return;
        setMessage(error instanceof Error ? error.message : "Waiting for the server");
        schedule(pollSeconds * 2, () => void poll());
      }
    };

    let pollSeconds = DEFAULT_POLL_SECONDS;

    const requestCode = async () => {
      setPhase("requesting");
      setMessage(null);
      try {
        const response = await api.requestDeviceCode({ app_variant: "tv", label });
        if (cancelled) return;
        deviceCode = response.device_code;
        // Honour the server's pace for every poll, not just the first. Polling
        // faster than told burns the request's poll budget and the server
        // rightly calls the code expired.
        pollSeconds = Math.max(
          response.poll_interval_seconds ?? DEFAULT_POLL_SECONDS,
          MIN_POLL_SECONDS,
        );
        setUserCode(response.user_code);
        setPhase("waiting");
        schedule(pollSeconds, () => void poll());
      } catch (error) {
        if (cancelled) return;
        setPhase("failed");
        setMessage(error instanceof Error ? error.message : "Could not reach the server");
        // Keep trying: a display switched on before the network comes up must
        // pair itself when it does, with nobody there to press anything.
        schedule(DEFAULT_POLL_SECONDS * 2, () => void requestCode());
      }
    };

    void requestCode();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [label, secretStore]);

  return (
    <View style={styles.screen}>
      <Text style={styles.eyebrow}>MEDBRAINS DISPLAY</Text>
      <Text style={styles.title}>Pair this screen</Text>

      {phase === "waiting" && userCode ? (
        <>
          <Text style={styles.instruction}>
            On a hospital workstation, open Admin, then Devices, and enter this code.
          </Text>
          <Text
            accessibilityLabel={`Pairing code ${userCode.split("").join(" ")}`}
            // One line, always. A code that wraps is a code somebody reads out
            // wrongly, and this one is read aloud across a room.
            adjustsFontSizeToFit
            numberOfLines={1}
            style={styles.code}
          >
            {userCode}
          </Text>
          <View style={styles.statusRow}>
            <ActivityIndicator color={COLORS.emerald} />
            <Text style={styles.status}>Waiting for approval…</Text>
          </View>
        </>
      ) : null}

      {phase === "requesting" ? (
        <View style={styles.statusRow}>
          <ActivityIndicator color={COLORS.emerald} />
          <Text style={styles.status}>Asking for a pairing code…</Text>
        </View>
      ) : null}

      {phase === "approved" ? (
        <Text style={styles.status}>Approved. Starting the board…</Text>
      ) : null}

      {phase === "denied" || phase === "failed" ? (
        <Text style={styles.problem}>{message}</Text>
      ) : null}

      {message && phase === "waiting" ? <Text style={styles.problem}>{message}</Text> : null}

      <Text style={styles.footnote}>
        This screen is granted only what a display needs. It never signs in as a member of staff,
        and it can be revoked on its own.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  code: {
    color: COLORS.canvas,
    fontFamily: "JetBrainsMono-Regular",
    fontSize: 108,
    letterSpacing: 8,
    marginVertical: SPACING.lg,
  },
  eyebrow: {
    color: COLORS.copper,
    fontFamily: "JetBrainsMono-Regular",
    fontSize: 24,
    letterSpacing: 6,
  },
  footnote: {
    color: COLORS.muted,
    fontFamily: "Inter-Regular",
    fontSize: 18,
    // In the flow rather than pinned: absolute positioning let it sit on top
    // of the code at the one moment the code is the only thing that matters.
    marginTop: SPACING.lg,
  },
  instruction: {
    color: COLORS.canvas,
    fontFamily: "Inter-Regular",
    fontSize: 28,
    marginTop: SPACING.md,
  },
  problem: {
    color: COLORS.amber,
    fontFamily: "Inter-Regular",
    fontSize: 24,
    marginTop: SPACING.sm,
  },
  screen: {
    backgroundColor: COLORS.brandDeep,
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: OVERSCAN.horizontal,
    paddingVertical: OVERSCAN.vertical,
  },
  status: {
    color: COLORS.emerald,
    fontFamily: "JetBrainsMono-Regular",
    fontSize: 24,
  },
  statusRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.sm,
  },
  title: {
    color: COLORS.canvas,
    fontFamily: "Fraunces-Regular",
    fontSize: 56,
  },
});
