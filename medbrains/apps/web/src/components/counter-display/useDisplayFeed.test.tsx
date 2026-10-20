import type { CounterDisplayState } from "@medbrains/types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDisplayFeed } from "./useDisplayFeed";

const getCounterDisplay = vi.fn();
vi.mock("@medbrains/api", () => ({ api: { getCounterDisplay: () => getCounterDisplay() } }));

/** A socket the test opens, feeds and drops by hand. */
class FakeSocket {
  static made: FakeSocket[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  constructor(readonly url: string) {
    FakeSocket.made.push(this);
  }
  close() {
    this.onclose?.();
  }
}

const state = (over: Partial<CounterDisplayState>): CounterDisplayState => ({
  seq: 1,
  session: "s1",
  phase: "session",
  patient: "Ravi S.",
  lines: [],
  total_due_paise: 0,
  tender: null,
  amount_paise: 0,
  qr: null,
  card_status: null,
  change_paise: null,
  ...over,
});

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useDisplayFeed", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeSocket.made = [];
    vi.stubGlobal("WebSocket", FakeSocket);
    getCounterDisplay.mockRejectedValue(new Error("offline"));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("goes live on the socket, announces a payment once, and reconnects after a drop", async () => {
    const announce = vi.fn();
    const { result, unmount } = renderHook(() => useDisplayFeed("device-jwt", announce), {
      wrapper,
    });
    const first = FakeSocket.made[0];
    expect(first?.url).toContain("/ws/counter-display?token=device-jwt");
    await act(async () => first?.onopen?.());
    expect(result.current.link).toBe("live");

    const paid = JSON.stringify(state({ seq: 4, phase: "paid", amount_paise: 60_000 }));
    await act(async () => {
      first?.onmessage?.({ data: paid });
      first?.onmessage?.({ data: paid });
    });
    expect(announce).toHaveBeenCalledTimes(1);
    expect(result.current.model.snapshot?.phase).toBe("paid");

    // Socket dropped and polling fails too: the screen must say so.
    await act(async () => first?.close());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(result.current.link).toBe("down");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(FakeSocket.made).toHaveLength(2);

    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(FakeSocket.made).toHaveLength(2);
  });

  it("closes a socket that has gone silent", async () => {
    renderHook(() => useDisplayFeed("t", vi.fn()), { wrapper });
    const socket = FakeSocket.made[0];
    const closed = vi.spyOn(socket as FakeSocket, "close");
    await act(async () => socket?.onopen?.());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(45_000);
    });
    expect(closed).toHaveBeenCalled();
  });
});
