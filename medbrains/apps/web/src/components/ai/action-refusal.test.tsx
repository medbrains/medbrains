import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/test-utils";
import { ToolView } from "./ToolView";

/** One finished `opd_queue_today` call with `result` as its tool output. */
function renderResult(result: unknown) {
  render(
    <ToolView toolCall={{ id: "c", name: "opd_queue_today", args: {}, result, status: "done" }} />,
  );
}

describe("an action the broker refused shows which refusal on screen", () => {
  it("could not check reads as not checked, never as not allowed", () => {
    renderResult({ refused: "unknown", message: "I couldn't check that right now." });
    expect(screen.getByText("Not checked")).toBeInTheDocument();
    expect(screen.getByText("I couldn't check that right now.")).toBeInTheDocument();
    expect(screen.queryByText("Not allowed")).not.toBeInTheDocument();
  });

  it("not allowed and needs confirmation each say so", () => {
    renderResult({ refused: "not_allowed", message: "You're not allowed to see this." });
    expect(screen.getByText("Not allowed")).toBeInTheDocument();
    renderResult({ refused: "needs_confirmation", message: "This needs your confirmation." });
    expect(screen.getByText("Needs your confirmation")).toBeInTheDocument();
    expect(screen.getAllByText("Reading today's OPD queue")).toHaveLength(2);
  });
});
