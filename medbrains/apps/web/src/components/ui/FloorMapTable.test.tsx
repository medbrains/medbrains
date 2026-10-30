import { describe, expect, it, vi } from "vitest";
import { render, screen, userEvent } from "@/test/test-utils";
import type { FloorMapZone } from "./FloorMap";
import { FloorMapTable } from "./FloorMapTable";

const ZONES: FloorMapZone[] = [
  {
    id: "bill",
    name: "Billing",
    row: 1,
    col: 1,
    band: 4,
    bandLabel: "Over limit",
    metric: "58 est.",
    queue: 22,
    staff: 2,
  },
  {
    id: "lab",
    name: "Lab",
    row: 1,
    col: 2,
    band: null,
    bandLabel: "Unknown",
    metric: "Unknown",
    queue: null,
    staff: null,
  },
];

describe("FloorMapTable", () => {
  it("says every level in words and an unknown count as Unknown, never 0", () => {
    render(
      <FloorMapTable
        zones={ZONES}
        caption="Floor G"
        metricLabel="Crowd"
        onZoneSelect={() => undefined}
      />,
    );
    expect(screen.getByText("Over limit")).toBeInTheDocument();
    expect(screen.getAllByText("Unknown").length).toBeGreaterThanOrEqual(3);
    expect(screen.queryByText("0")).not.toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Crowd" })).toBeInTheDocument();
  });

  it("is the map's keyboard surface: focus highlights, Enter inspects", async () => {
    const select = vi.fn();
    const focus = vi.fn();
    render(
      <FloorMapTable
        zones={ZONES}
        caption="Floor G"
        metricLabel="Crowd"
        onZoneSelect={select}
        onZoneFocus={focus}
      />,
    );
    await userEvent.tab();
    expect(focus).toHaveBeenCalledWith("bill");
    await userEvent.keyboard("{Enter}");
    expect(select).toHaveBeenCalledWith("bill");
    expect(screen.getByRole("button", { name: "Inspect Lab" })).toBeInTheDocument();
  });

  it("on a wall board, rows are read, not pressed", () => {
    render(<FloorMapTable zones={ZONES} caption="Floor G" metricLabel="People" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText("Billing")).toBeInTheDocument();
  });
});
