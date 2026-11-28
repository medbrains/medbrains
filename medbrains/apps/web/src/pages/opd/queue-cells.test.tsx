import type { QueueEntry } from "@medbrains/types";
import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/test-utils";
import { QueueTokenCell } from "./queue-cells";

const row = (extra: Partial<QueueEntry>) =>
  ({ token_number: 3, token_code: "R-003", token_priority: "normal", ...extra }) as QueueEntry;

describe("the OPD queue's token cell", () => {
  it("says a moved-up patient's priority in words, with the desk's reason", () => {
    render(
      <QueueTokenCell
        row={row({
          token_priority: "stat",
          token_priority_escalated: true,
          token_priority_reason: "Collapsed in the waiting area",
        })}
      />,
    );
    expect(screen.getByText("R-003")).toBeInTheDocument();
    expect(screen.getByText("STAT")).toBeInTheDocument();
    expect(screen.getByText("Collapsed in the waiting area")).toBeInTheDocument();
    expect(screen.getByLabelText("Moved up")).toBeInTheDocument();
  });

  it("names an arrival lane without the moved-up arrow, and prints no empty reason", () => {
    render(
      <QueueTokenCell row={row({ token_priority: "appointment", token_priority_reason: null })} />,
    );
    expect(screen.queryByLabelText("Moved up")).not.toBeInTheDocument();
    expect(screen.queryByText("null")).not.toBeInTheDocument();
  });

  it("shows no badge for an ordinary token, or one from a server that sends no priority", () => {
    render(<QueueTokenCell row={row({})} />);
    render(<QueueTokenCell row={row({ token_code: "R-004", token_priority: null })} />);
    expect(screen.queryByText("Normal")).not.toBeInTheDocument();
    expect(screen.queryByText("STAT")).not.toBeInTheDocument();
  });
});
