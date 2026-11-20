import { useModuleStore, usePermissionStore } from "@medbrains/stores";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/test-utils";

const getWaitEstimate = vi.fn();
vi.mock("@/services/opd.service", () => ({
  opdService: { getWaitEstimate: () => getWaitEstimate() },
}));

const { BoardWaitEstimate } = await import("./board-wait-estimate");

describe("BoardWaitEstimate", () => {
  beforeEach(() => {
    getWaitEstimate.mockResolvedValue({
      estimated_minutes: 12,
      queue_position: 3,
      median_consultation_minutes: 4,
    });
    act(() => usePermissionStore.setState({ userRole: "super_admin" }));
  });
  afterEach(() => {
    getWaitEstimate.mockReset();
    act(() => {
      usePermissionStore.setState({ userRole: null });
      useModuleStore.getState().clearModules();
    });
  });

  it("shows the wait where the hospital runs the EMR", async () => {
    render(<BoardWaitEstimate />);
    expect(await screen.findByText("tokenBoards.wait.minutes")).toBeInTheDocument();
    expect(getWaitEstimate).toHaveBeenCalled();
  });

  // Decision in docs/DECISIONS.md: the queue's wait goes with the EMR; the board neither asks
  // the server (it would answer 403) nor shows an error to the waiting room.
  it("asks nothing and shows nothing while the EMR is switched off", () => {
    act(() => useModuleStore.getState().setDisabledModules(["opd"]));
    render(<BoardWaitEstimate />);
    expect(getWaitEstimate).not.toHaveBeenCalled();
    expect(screen.queryByText("tokenBoards.wait.label")).not.toBeInTheDocument();
  });
});
