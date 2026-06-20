import { Group } from "@mantine/core";
import { api } from "@medbrains/api";
import type { ModuleToken } from "@medbrains/types";
import { IconVolume, IconVolumeOff } from "@tabler/icons-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Badge, type BadgeTone, IconButton, TokenDashboard, type TokenItem } from "@/components/ui";

const STATUS_TONE: Record<string, BadgeTone> = {
  waiting: "neutral",
  called: "warning",
  serving: "info",
};

const STATUS_LABEL: Record<string, string> = {
  waiting: "Waiting",
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

/** Speak "Token T 014, please proceed to <where>" via the Web Speech API. */
function announceCall(tokenNumber: string, where?: string | null) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const spoken = tokenNumber.replace(/-/g, " ");
  const text = where ? `Token ${spoken}, please proceed to ${where}.` : `Token ${spoken}.`;
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = 0.95;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utter);
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

  // Instant refresh + voice announce on token events (external WS system).
  useEffect(() => {
    if (!scopeId) return;
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${proto}://${window.location.host}/ws/queue/${scopeId}`);
    ws.onmessage = (event) => {
      void queryClient.invalidateQueries({ queryKey });
      if (mutedRef.current) return;
      try {
        const message = JSON.parse(event.data);
        if (message?.type === "token_called") {
          announceCall(message.token_number, message.room ?? message.counter);
        }
      } catch {
        // non-JSON frame — ignore
      }
    };
    return () => ws.close();
    // queryKey is derived from these deps; safe to omit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeId, module, scope, queryClient]);

  const tokens = (data ?? []).map((token) => toItem(token, publicMode));
  return (
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
}
