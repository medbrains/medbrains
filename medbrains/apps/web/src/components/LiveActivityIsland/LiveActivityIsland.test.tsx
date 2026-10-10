import { MantineProvider } from "@mantine/core";
import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LiveActivityIsland } from "./LiveActivityIsland";
import { useLiveActivityStore } from "./live-activity-store";

const renderIsland = () =>
  render(
    <MantineProvider>
      <LiveActivityIsland />
    </MantineProvider>,
  );

describe("the live activity island", () => {
  afterEach(() => act(() => useLiveActivityStore.getState().setActivity("code", null)));

  it("shows nothing when nothing is live", () => {
    renderIsland();
    expect(screen.queryByRole("button", { name: /assistant/i })).toBeNull();
    expect(screen.queryByText("MedBrains")).toBeNull();
  });

  it("still shows a live emergency code", () => {
    renderIsland();
    act(() =>
      useLiveActivityStore.getState().setActivity("code", {
        priority: 100,
        tone: "code",
        kind: "code_blue",
        title: "Code Blue — Ward 3",
      }),
    );
    expect(screen.getByText("Code Blue — Ward 3")).toBeTruthy();
  });
});
