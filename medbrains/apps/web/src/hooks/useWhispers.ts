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
    void (async () => {
      try {
        const response = await api.whisperStream(controller.signal);
        if (!response.ok || !response.body) return;
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
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
      } catch {
        // Aborted on unmount, or the stream dropped — nothing to do.
      }
    })();
    return () => controller.abort();
  });
}
