import { P } from "@medbrains/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent } from "@/test/test-utils";
import { PreauthNhcxActions } from "./PreauthNhcxActions";

/**
 * A pre-auth is withdrawn from its drawer as a cancel Task (PC01), under its
 * own permission, with the reason the payer reads. A desk without the
 * permission never sees the button; a closed pre-auth cannot be cancelled.
 */
const held = vi.hoisted(() => ({ permissions: new Set<string>() }));
const mocks = vi.hoisted(() => ({ cancel: vi.fn(), status: vi.fn() }));

vi.mock("@medbrains/stores", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useHasPermission: (code: string) => held.permissions.has(code),
}));
vi.mock("@medbrains/api", () => ({
  api: { cancelNhcxPreauth: mocks.cancel, checkPreauthNhcxStatus: mocks.status },
}));

const PAYER = "1000004805";

describe("PreauthNhcxActions", () => {
  beforeEach(() => {
    held.permissions = new Set([P.INSURANCE.NHCX.CANCEL_PREAUTH]);
    mocks.cancel.mockReset().mockResolvedValue({ queued: true });
  });

  it("sends the cancel with the reason the desk wrote", async () => {
    render(<PreauthNhcxActions priorAuthId="pa-1" status="in_review" recipient={PAYER} />);
    await userEvent.click(screen.getByRole("button", { name: "Cancel pre-auth" }));
    await userEvent.type(await screen.findByLabelText(/Reason/), "Patient not admitted");
    await userEvent.click(screen.getByRole("button", { name: "Ask the payer to cancel" }));
    expect(mocks.cancel).toHaveBeenCalledWith("pa-1", { reason: "Patient not admitted" });
  });

  it("offers no cancel without the permission", () => {
    held.permissions = new Set([P.INSURANCE.NHCX.SUBMIT]);
    render(<PreauthNhcxActions priorAuthId="pa-1" status="in_review" recipient={PAYER} />);
    expect(screen.queryByRole("button", { name: "Cancel pre-auth" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Check status with the payer" })).toBeVisible();
  });

  it("cannot cancel a pre-auth the payer already denied", () => {
    render(<PreauthNhcxActions priorAuthId="pa-1" status="denied" recipient={PAYER} />);
    expect(screen.getByRole("button", { name: "Cancel pre-auth" })).toBeDisabled();
  });
});
