import { useAuthStore } from "@medbrains/stores";
import type { User } from "@medbrains/types";
import { describe, expect, it } from "vitest";
import { useAlertSoundPrefsStore } from "@/lib/alert-sound-prefs";
import { render, screen, userEvent } from "@/test/test-utils";
import { AlertSoundsCard } from "./alert-sounds-card";

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
