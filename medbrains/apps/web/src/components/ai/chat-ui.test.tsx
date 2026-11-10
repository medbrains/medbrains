import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/test-utils";
import { suggestionsFor } from "./suggestions";
import { ThinkingIndicator } from "./ThinkingIndicator";
import type { ChatMessage, ChatToolCall } from "./transport/types";
import { UnifiedResponse } from "./UnifiedResponse";

const call = (id: string, result: unknown): ChatToolCall => ({
  id,
  name: "call_api",
  args: {},
  status: "done",
  result,
});

const answer = (toolCalls: ChatToolCall[]): ChatMessage => ({
  id: "a",
  role: "assistant",
  content: "Two beds are free.",
  createdAt: "2026-10-25T09:00:00Z",
  status: "complete",
  toolCalls,
});

describe("routine lookups fold away; safety results stay in view", () => {
  it("folds done lookups into one collapsed row that opens on demand", async () => {
    render(<UnifiedResponse message={answer([call("1", { ok: 1 }), call("2", { ok: 2 })])} />);
    const toggle = screen.getByRole("button", { name: "Looked up 2 steps" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
  });

  it("never folds a drug that was not checked", () => {
    const unchecked = call("3", { drug: "X", checked: false, notes: "X was not checked." });
    render(<UnifiedResponse message={answer([call("1", { ok: 1 }), unchecked])} />);
    expect(screen.getByText("Not checked")).toBeVisible();
    expect(screen.getByText("X was not checked.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Looked up 1 step" })).toBeInTheDocument();
  });
});

describe("the thinking state is announced", () => {
  it("is a polite status with a spoken label", () => {
    render(<ThinkingIndicator />);
    expect(screen.getByRole("status")).toHaveTextContent("Assistant is thinking");
  });
});

describe("suggestions follow the screen", () => {
  it("offers patient questions only when a patient is open", () => {
    expect(suggestionsFor({ patient_id: "p1" }).starters[0]).toMatch(/patient/);
    expect(suggestionsFor(undefined).starters.join(" ")).not.toMatch(/this patient/);
  });
});
