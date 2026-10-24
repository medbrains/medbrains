import { act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/test-utils";
import { AiAssistantMount } from "./AiAssistantMount";
import { useAiAssistantStore } from "./assistant-store";

const { panelLoaded } = vi.hoisted(() => ({ panelLoaded: vi.fn() }));
vi.mock("./AiChatPanel", () => {
  panelLoaded();
  return { AiChatPanel: () => <p>assistant panel</p> };
});

// The history menu reads the conversation list once the drawer is open.
vi.mock("@medbrains/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@medbrains/api")>();
  return { ...actual, api: { ...actual.api, listAiConversations: async () => [] } };
});

afterEach(() => {
  act(() => useAiAssistantStore.getState().close());
});

describe("the shell assistant keeps its heavy panel out of the first load", () => {
  it("does not fetch the panel until the assistant is opened, then shows it", async () => {
    render(<AiAssistantMount />);
    expect(panelLoaded).not.toHaveBeenCalled();
    expect(screen.queryByText("assistant panel")).not.toBeInTheDocument();

    act(() => useAiAssistantStore.getState().toggle());

    expect(await screen.findByText("assistant panel")).toBeInTheDocument();
    expect(panelLoaded).toHaveBeenCalledTimes(1);
  });
});
