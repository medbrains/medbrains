import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/test-utils";

/**
 * A sign-off queue that failed to load says so (#6009). It used to read the
 * failure as an empty list, "Nothing pending. All caught up.", which tells a
 * doctor their unsigned reports do not exist.
 */
const getMyPendingSignoffs = vi.fn();
vi.mock("@/services/signoff.service", () => ({
  signoffService: { getMyPendingSignoffs: () => getMyPendingSignoffs() },
}));
vi.mock("@/hooks/useRequirePermission", () => ({ useRequirePermission: () => {} }));
vi.mock("@/hooks/useSignableTypes", () => ({
  useSignableTypes: () => ({ types: undefined, isError: false }),
}));
vi.mock("@/components/Clinical/case-sheet/UnsignedNotesCard", () => ({
  UnsignedNotesCard: () => null,
}));
vi.mock("@/components/Clinical/case-sheet/CountersignCard", () => ({
  CountersignCard: () => null,
}));

const { SignoffsPage } = await import("./signoffs");

describe("SignoffsPage", () => {
  it("shows a failed load as a failure, never as an empty queue", async () => {
    getMyPendingSignoffs.mockRejectedValue(new Error("500"));
    render(<SignoffsPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("The sign-off list didn't load");
    expect(screen.getByRole("button", { name: "Retry" })).toBeVisible();
    expect(screen.queryByText("Nothing pending. All caught up.")).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /All/ })).toHaveTextContent("All —");
  });

  it("still says all caught up when the queue really is empty", async () => {
    getMyPendingSignoffs.mockResolvedValue([]);
    render(<SignoffsPage />);
    expect(await screen.findByText("Nothing pending. All caught up.")).toBeVisible();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
