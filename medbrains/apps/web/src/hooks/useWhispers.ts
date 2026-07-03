import { api } from "@medbrains/api";
import { useEffectOnce } from "react-use";
import { useAiAssistantStore } from "@/components/ai";
import { toast } from "@/components/ui";

interface WhisperPayload {
  type?: string;
  title?: string;
  message?: string;
  patientId?: string;
  kind?: string;
}

function parseFrame(frame: string): WhisperPayload | null {
  const dataLine = frame.split("\n").find((line) => line.startsWith("data:"));
  if (!dataLine) return null;
  try {
    return JSON.parse(dataLine.slice(5).trim());
  } catch {
    return null;
  }
}

function showWhisper(whisper: WhisperPayload) {
  const message = whisper.message ?? "Critical value";
  toast.error(message, {
    title: whisper.title ?? "Critical alert",
    actions: [
      {
        label: "Ask AI",
        primary: true,
        onClick: () =>
          useAiAssistantStore.getState().open({
            query: `Explain this critical result and what to do next: ${message}`,
            context: whisper.patientId ? { patient_id: whisper.patientId } : undefined,
          }),
      },
    ],
  });
}

/**
 * Subscribes to the proactive-whisper SSE (GET /api/ai/whispers) and surfaces
 * critical alerts as toasts with an "Ask AI" action. Mounted once, app-wide.
 */
export function useWhispers() {
  useEffectOnce(() => {
    const controller = new AbortController();
    let stopped = false;
    let backoff = 3000;

    const readStream = async () => {
      const response = await api.whisperStream(controller.signal);
      if (!response.ok || !response.body) {
        throw new Error(`whisper stream ${response.status}`);
      }
      backoff = 3000; // a good connection resets the backoff
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (!stopped) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        for (;;) {
          const sep = buffer.indexOf("\n\n");
          if (sep === -1) break;
          const frame = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          const payload = parseFrame(frame);
          if (payload?.type === "whisper") {
            showWhisper(payload);
          }
        }
      }
    };

    // Long-lived: if the stream drops (backend restart, network blip) reconnect
    // with capped exponential backoff so whispers resume without a page reload.
    void (async () => {
      while (!stopped) {
        try {
          await readStream();
        } catch {
          if (stopped || controller.signal.aborted) return;
        }
        if (stopped) return;
        await new Promise((resolve) => setTimeout(resolve, backoff));
        backoff = Math.min(backoff * 2, 30_000);
      }
    })();

    return () => {
      stopped = true;
      controller.abort();
    };
  });
}
