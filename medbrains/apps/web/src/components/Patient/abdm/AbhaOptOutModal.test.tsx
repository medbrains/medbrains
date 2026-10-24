import { describe, expect, it, vi } from "vitest";
import { render, screen, userEvent } from "@/test/test-utils";
import { AbhaOptOutModal } from "./AbhaOptOutModal";

describe("AbhaOptOutModal (HIP_INIT_ABHA_OPTOUT_DEACTIVATE)", () => {
  it("records nothing without a reason and the patient's own request", async () => {
    render(<AbhaOptOutModal patientId="p1" opened onClose={vi.fn()} />);
    const optOut = screen.getByRole("button", { name: "Opt out of ABDM" });
    expect(optOut).toBeDisabled();
    expect(screen.getByText(/Verifying the ABHA again links it back/)).toBeInTheDocument();
    await userEvent.type(
      screen.getByRole("textbox", { name: /Why is the patient opting out/ }),
      "No sharing",
    );
    await userEvent.click(screen.getByRole("checkbox", { name: "The patient asked for this" }));
    expect(optOut).toBeEnabled();
  });
});
