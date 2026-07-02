import type { ChatChunk, ChatMessage, ChatTransport, SendOptions } from "./types";

// ponytail: dev/demo transport — streams a canned reply word-by-word so every
// surface is fully usable before the real SSE backend (v2) exists.

const STREAM_DELAY_MS = 35;

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new DOMException("aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

export interface MockTransportOptions {
  /** Override the reply for deterministic stories/tests. */
  reply?: (lastUserText: string) => string;
}

export class MockTransport implements ChatTransport {
  private readonly reply: (lastUserText: string) => string;

  constructor(options: MockTransportOptions = {}) {
    this.reply =
      options.reply ??
      ((text) =>
        `You said: **"${text}"**.\n\nThis is a mock assistant response — the real backend isn't wired yet. It renders _markdown_, lists:\n\n- one\n- two\n\nand \`inline code\`.`);
  }

  async *send(messages: ChatMessage[], opts: SendOptions): AsyncIterable<ChatChunk> {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    const text = this.reply(lastUser?.content ?? "");
    try {
      for (const token of text.split(/(\s+)/)) {
        await delay(STREAM_DELAY_MS, opts.signal);
        yield { type: "text", delta: token };
      }
      yield { type: "done" };
    } catch {
      // AbortError from delay() — cancellation is a clean stop, not an error.
      yield { type: "done" };
    }
  }
}
