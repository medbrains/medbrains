import { useAuthStore } from "@medbrains/stores";
import type { User } from "@medbrains/types";
import { describe, expect, it, vi } from "vitest";
import { useAlertSoundPrefsStore } from "@/lib/alert-sound-prefs";
import { render, screen, userEvent } from "@/test/test-utils";
import { AlertSoundsCard } from "./alert-sounds-card";

// Node's own (file-less) localStorage shadows jsdom's here; the persisted
// stores need a working one before they are created.
vi.hoisted(() => {
  const items = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
    clear: () => items.clear(),
    key: () => null,
    length: 0,
  } as Storage;
});

describe("AlertSoundsCard", () => {
  it("mutes calm for the signed-in person only, and offers no way to mute urgent", async () => {
    useAuthStore.setState({ user: { id: "nurse-1" } as User });
    render(<AlertSoundsCard />);
    await userEvent.click(screen.getByRole("switch", { name: /Calm/ }));
    expect(useAlertSoundPrefsStore.getState().byUser["nurse-1"]?.muteCalm).toBe(true);
    expect(useAlertSoundPrefsStore.getState().byUser["nurse-2"]).toBeUndefined();
    expect(screen.queryByRole("switch", { name: /Urgent/ })).not.toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "Urgent alert volume" })).toHaveAttribute(
      "aria-valuemin",
      "40",
    );
  });
});
