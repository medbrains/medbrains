import { describe, expect, it, vi } from "vitest";
import { render, screen, userEvent } from "@/test/test-utils";
import { AbhaCloseModal } from "./AbhaCloseModal";

describe("AbhaCloseModal (PROF_ABHA_605)", () => {
  it("sends nothing until staff give a reason and confirm the patient asked", async () => {
    render(
      <AbhaCloseModal verificationId="v1" opened onClose={vi.fn()} onClosed={vi.fn()} />,
    );
    const send = screen.getByRole("button", { name: "Send the OTP" });
    expect(send).toBeDisabled();
    await userEvent.type(
      screen.getByRole("textbox", { name: /Why is the patient closing/ }),
      "Moving abroad",
    );
    expect(send).toBeDisabled();
    await userEvent.click(screen.getByRole("checkbox", { name: /patient asked for this/ }));
    expect(send).toBeEnabled();
  });

  it("says plainly that deleting cannot be undone, and deactivating can", async () => {
    render(
      <AbhaCloseModal verificationId="v1" opened onClose={vi.fn()} onClosed={vi.fn()} />,
    );
    expect(screen.getByText(/until they reactivate it/)).toBeInTheDocument();
    await userEvent.click(screen.getByText("Delete for good"));
    expect(screen.getByText(/It cannot be undone/)).toBeInTheDocument();
  });
});
