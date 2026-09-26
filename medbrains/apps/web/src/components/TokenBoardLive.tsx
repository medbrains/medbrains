import { Box, Group, Stack, Text } from "@mantine/core";
import { api } from "@medbrains/api";
import type { ModuleToken } from "@medbrains/types";
import { IconVolume, IconVolumeOff } from "@tabler/icons-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Badge,
  type BadgeTone,
  IconButton,
  TokenDashboard,
  type TokenItem,
} from "@/components/ui";
import { announceCall, unspeakable, VOICE_LANGUAGES, type VoiceLanguage } from "@/lib/board-voice";
import classes from "./token-board-alert.module.scss";

/** An emergency announcement, as the board received it. */
interface BoardAlert {
  id: string;
  message: string;
  priority: string;
}

/** How long a code stays on the board before it stops shouting. */
const ALERT_VISIBLE_MS = 5 * 60 * 1000;

/**
 * What arrived on the board's socket.
 *
 * Two different shapes come down one channel. A queue event is tagged
 * (`type: "token_called"`); an announcement is not tagged at all, which is why
 * the board used to drop every one of them — a code blue reached every screen
 * in the hospital and lit up none of them.
 */
export type BoardFrame =
  | { kind: "token"; tokenNumber: string; where?: string }
  | { kind: "alert"; alert: BoardAlert }
  | { kind: "ignore" };

export function classifyBoardFrame(raw: unknown): BoardFrame {
  if (!raw || typeof raw !== "object") return { kind: "ignore" };
  const frame = raw as Record<string, unknown>;
  if (frame.type === "token_called" && typeof frame.token_number === "string") {
    const where = frame.room ?? frame.counter;
    return {
      kind: "token",
      tokenNumber: frame.token_number,
      where: typeof where === "string" ? where : undefined,
    };
  }
  if (typeof frame.message === "string" && typeof frame.priority === "string") {
    return {
      kind: "alert",
      alert: {
        id: typeof frame.id === "string" ? frame.id : frame.message,
        message: frame.message,
        priority: frame.priority,
      },
    };
  }
  return { kind: "ignore" };
}

const STATUS_TONE: Record<string, BadgeTone> = {
  waiting: "neutral",
  on_hold: "info",
  called: "warning",
  serving: "info",
};

const STATUS_LABEL: Record<string, string> = {
  waiting: "Waiting",
  // Their number stays on the board, so a patient back from an ECG sees they
  // still have their place.
  on_hold: "On hold",
  called: "Called",
  serving: "In progress",
};

function toItem(token: ModuleToken, publicMode: boolean): TokenItem {
  // Public (TV) boards are token-number-only — no patient name (PHI).
  const primary = publicMode
    ? (token.counter_label ?? token.scope_label ?? undefined)
    : (token.counter_label ?? token.scope_label ?? token.patient_name ?? undefined);
  return {
    id: token.id,
    tokenNumber: token.number,
    status: STATUS_LABEL[token.status] ?? token.status,
    tone: STATUS_TONE[token.status] ?? "neutral",
    primary,
    meta: token.priority !== "normal" ? token.priority : undefined,
    active: token.status === "called" || token.status === "serving",
  };
}

/** Say an emergency announcement out loud, twice, over anything queued. */
function speak(message: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  for (let i = 0; i < 2; i += 1) {
    const utter = new SpeechSynthesisUtterance(message);
    utter.rate = 0.9;
    window.speechSynthesis.speak(utter);
  }
}

export interface TokenBoardLiveProps {
  title: string;
  module: string;
  scope?: string;
  scopeId?: string;
  /** Public/TV mode — token-number-only (no patient name). */
  publicMode?: boolean;
  /** TV/waiting-area mode — scales token numbers up for distance reading. */
  display?: boolean;
}

/**
 * Live token board — polls the board endpoint (baseline) and subscribes to the
 * queue WebSocket for instant refresh + a voice call-out on each "token called"
 * event. Maps ModuleToken[] into the presentational TokenDashboard. Web/mobile/TV.
 */
export function TokenBoardLive({
  title,
  module,
  scope,
  scopeId,
  publicMode = false,
  display = false,
}: TokenBoardLiveProps) {
  const queryClient = useQueryClient();
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const queryKey = ["token-board", module, scope, scopeId];

  const { data } = useQuery({
    queryKey,
    queryFn: () => api.listTokenBoard({ module, scope, scope_id: scopeId }),
    refetchInterval: 8000,
  });

  const [alert, setAlert] = useState<BoardAlert | null>(null);

  // How this place's queue speaks: its languages and repeat count.
  const { data: voice } = useQuery({
    queryKey: ["token-board-config", module, scope, scopeId],
    queryFn: () => api.getBoardConfig({ module, scope, scope_id: scopeId }),
    staleTime: 60_000,
  });
  const voiceRef = useRef(voice);
  voiceRef.current = voice;

  // A browser will not speak until someone has pressed a key or touched the
  // page — and a waiting-room TV is the screen nobody touches. Say so, rather
  // than let the board fall silent with nothing on screen to explain it.
  const [canSpeak, setCanSpeak] = useState(
    () => typeof navigator === "undefined" || (navigator.userActivation?.hasBeenActive ?? true),
  );
  useEffect(() => {
    if (canSpeak) return;
    const enable = () => setCanSpeak(true);
    window.addEventListener("pointerdown", enable, { once: true });
    window.addEventListener("keydown", enable, { once: true });
    return () => {
      window.removeEventListener("pointerdown", enable);
      window.removeEventListener("keydown", enable);
    };
  }, [canSpeak]);

  // Instant refresh + voice announce on token events (external WS system).
  useEffect(() => {
    if (!scopeId) return;
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${proto}://${window.location.host}/ws/queue/${scopeId}`);
    ws.onmessage = (event) => {
      void queryClient.invalidateQueries({ queryKey });
      if (mutedRef.current) return;
      try {
        const frame = classifyBoardFrame(JSON.parse(event.data));
        if (frame.kind === "token") {
          announceCall(frame.tokenNumber, frame.where, {
            languages: voiceRef.current?.voice_languages ?? ["en"],
            repeat: voiceRef.current?.announce_repeat ?? 1,
          });
        } else if (frame.kind === "alert") {
          setAlert(frame.alert);
          speak(frame.alert.message);
        }
      } catch {
        // non-JSON frame — ignore
      }
    };
    return () => ws.close();
    // queryKey is derived from these deps; safe to omit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeId, module, scope, queryClient]);

  // The code clears itself. A banner that stays up all afternoon is one the
  // staff stop seeing, and the next one arrives on a screen nobody reads.
  useEffect(() => {
    if (!alert) return;
    const timer = window.setTimeout(() => setAlert(null), ALERT_VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [alert]);

  const tokens = (data ?? []).map((token) => toItem(token, publicMode));
  const board = (
    <TokenDashboard
      title={title}
      tokens={tokens}
      display={display}
      headerRight={
        <Group gap="xs">
          <IconButton
            tone="default"
            aria-label={muted ? "Unmute announcements" : "Mute announcements"}
            onClick={() => setMuted((value) => !value)}
          >
            {muted ? <IconVolumeOff size={16} /> : <IconVolume size={16} />}
          </IconButton>
          <Badge tone="success">Live</Badge>
        </Group>
      }
    />
  );

  const languages: VoiceLanguage[] = voice?.voice_languages ?? ["en"];
  const missing =
    typeof window !== "undefined" && "speechSynthesis" in window
      ? unspeakable(languages, window.speechSynthesis.getVoices())
      : [];
  const named = (codes: VoiceLanguage[]) =>
    codes.map((code) => VOICE_LANGUAGES.find((l) => l.value === code)?.label ?? code).join(", ");
  const withNotices = (
    <Stack gap="xs">
      {display && !muted && !canSpeak && (
        <Alert tone="warning" data-testid="board-voice-blocked">
          Voice is off until someone presses a key or taps this screen once.
        </Alert>
      )}
      {display && !muted && missing.length > 0 && (
        <Alert tone="info" data-testid="board-voice-missing">
          This screen has no {named(missing)} voice installed — calls are spoken in the others.
        </Alert>
      )}
      {board}
    </Stack>
  );

  if (!alert) return withNotices;
  return (
    <Stack gap={0}>
      <Box
        className={`${classes.banner} ${
          alert.priority === "emergency" ? classes.emergency : classes.urgent
        } ${classes.pulse}`}
        role="alert"
        aria-live="assertive"
      >
        <Text className={classes.message}>{alert.message}</Text>
        <Text className={classes.since}>Announced just now</Text>
      </Box>
      {withNotices}
    </Stack>
  );
}
