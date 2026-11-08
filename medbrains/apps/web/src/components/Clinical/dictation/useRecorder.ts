import { useRef, useState } from "react";
import { useUnmount } from "react-use";

/** The server's limit: a consultation, not a ward round. */
export const MAX_DICTATION_MS = 10 * 60 * 1000;
const TICK_MS = 1000;

export type RecorderState =
  | { kind: "idle" }
  | { kind: "recording"; elapsedMs: number }
  | { kind: "unavailable"; reason: string };

export interface Recording {
  audio: Blob;
  durationMs: number;
}

/**
 * The browser's microphone through MediaRecorder: start, a ticking clock,
 * stop (or the ten-minute limit) hands back the recording. The microphone is
 * released on stop and on unmount, so leaving the screen never leaves it on.
 */
export function useRecorder(onRecorded: (recording: Recording) => void) {
  const [state, setState] = useState<RecorderState>({ kind: "idle" });
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAt = useRef(0);

  function release() {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    for (const track of recorder.current?.stream.getTracks() ?? []) track.stop();
    recorder.current = null;
  }

  async function start() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setState({ kind: "unavailable", reason: "This browser cannot record. Upload a recording." });
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setState({
        kind: "unavailable",
        reason: "The microphone is blocked. Allow it for this site, or upload a recording.",
      });
      return;
    }
    const chunks: Blob[] = [];
    const rec = new MediaRecorder(stream);
    rec.ondataavailable = (event) => chunks.push(event.data);
    rec.onstop = () => {
      const durationMs = Math.min(Date.now() - startedAt.current, MAX_DICTATION_MS);
      release();
      setState({ kind: "idle" });
      onRecorded({ audio: new Blob(chunks, { type: rec.mimeType || "audio/webm" }), durationMs });
    };
    recorder.current = rec;
    startedAt.current = Date.now();
    rec.start();
    setState({ kind: "recording", elapsedMs: 0 });
    timer.current = setInterval(() => {
      const elapsedMs = Date.now() - startedAt.current;
      if (elapsedMs >= MAX_DICTATION_MS) stop();
      else setState({ kind: "recording", elapsedMs });
    }, TICK_MS);
  }

  function stop() {
    if (recorder.current?.state === "recording") recorder.current.stop();
  }

  useUnmount(() => {
    if (recorder.current) recorder.current.onstop = null;
    stop();
    release();
  });

  return { state, start, stop };
}

/** `4:05` from milliseconds. */
export function formatClock(ms: number): string {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}
