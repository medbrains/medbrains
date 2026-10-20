import { api } from "@medbrains/api";
import type { CounterDisplayState, CounterDisplayView } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  backoffMs,
  type DisplayLink,
  type DisplayModel,
  INITIAL_MODEL,
  reduceDisplay,
  shouldAnnounce,
} from "./display-machine";

/** Poll this often while the socket is down; rarely while it is up. */
const POLL_DOWN_MS = 3_000;
const POLL_UP_MS = 60_000;
/** The server re-sends every 20 s; silence for this long means a dead socket. */
const SILENCE_MS = 45_000;

export interface DisplayFeed {
  view: CounterDisplayView | undefined;
  model: DisplayModel;
  link: DisplayLink;
}

function socketUrl(token: string): string {
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${window.location.host}/ws/counter-display?token=${encodeURIComponent(token)}`;
}

/**
 * A paired display's live feed: the socket first, polling while it is down,
 * and "down" when neither answers — so the screen says "Reconnecting…"
 * instead of showing a payment it can no longer vouch for.
 */
export function useDisplayFeed(
  token: string,
  onAnnounce: (state: CounterDisplayState) => void,
): DisplayFeed {
  const [model, setModel] = useState(INITIAL_MODEL);
  const modelRef = useRef(model);
  const announceRef = useRef(onAnnounce);
  announceRef.current = onAnnounce;
  const step = (state: CounterDisplayState) => {
    const before = modelRef.current;
    const after = reduceDisplay(before, state, Date.now());
    if (after === before) return;
    modelRef.current = after;
    setModel(after);
    if (shouldAnnounce(before, after)) announceRef.current(state);
  };
  const stepRef = useRef(step);
  stepRef.current = step;

  const [socketOpen, setSocketOpen] = useState(false);
  const poll = useQuery({
    queryKey: ["counter-display", token],
    queryFn: async () => {
      const view = await api.getCounterDisplay();
      stepRef.current(view.state);
      return view;
    },
    refetchInterval: socketOpen ? POLL_UP_MS : POLL_DOWN_MS,
    retry: false,
  });

  // The socket is an external system: open, watch, reconnect with backoff,
  // and tear every timer down with the component.
  useEffect(() => {
    let socket: WebSocket | null = null;
    let attempt = 0;
    let retryTimer: number | undefined;
    let silenceTimer: number | undefined;
    let closed = false;
    const armSilence = () => {
      window.clearTimeout(silenceTimer);
      silenceTimer = window.setTimeout(() => socket?.close(), SILENCE_MS);
    };
    const open = () => {
      socket = new WebSocket(socketUrl(token));
      socket.onopen = () => {
        attempt = 0;
        setSocketOpen(true);
        armSilence();
      };
      socket.onmessage = (event) => {
        armSilence();
        try {
          stepRef.current(JSON.parse(String(event.data)) as CounterDisplayState);
        } catch {
          // Not a snapshot — ignore it.
        }
      };
      socket.onclose = () => {
        setSocketOpen(false);
        window.clearTimeout(silenceTimer);
        if (closed) return;
        retryTimer = window.setTimeout(open, backoffMs(attempt));
        attempt += 1;
      };
    };
    open();
    return () => {
      closed = true;
      window.clearTimeout(retryTimer);
      window.clearTimeout(silenceTimer);
      socket?.close();
    };
  }, [token]);

  const link: DisplayLink = socketOpen
    ? "live"
    : poll.isSuccess && !poll.isError
      ? "polling"
      : "down";
  return { view: poll.data, model, link };
}
