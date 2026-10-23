import { describe, expect, it, vi } from "vitest";
import { render, screen, userEvent } from "@/test/test-utils";
import { ABHA_ENROL_CONSENT, ABHA_ENROL_CONSENT_VERSION } from "./abhaConsent";
import { ResendOtpButton } from "./ResendOtpButton";

describe("ResendOtpButton", () => {
  it("waits out the pause, then resends", async () => {
    const onResend = vi.fn();
    const { rerender } = render(
      <ResendOtpButton wait={42} resendsLeft={2} loading={false} onResend={onResend} />,
    );
    expect(screen.getByRole("button", { name: "Resend OTP in 42s" })).toBeDisabled();
    rerender(<ResendOtpButton wait={0} resendsLeft={1} loading={false} onResend={onResend} />);
    await userEvent.click(screen.getByRole("button", { name: "Resend OTP" }));
    expect(onResend).toHaveBeenCalledOnce();
    expect(screen.getByText("One resend left")).toBeInTheDocument();
  });

  it("offers no third resend — ABDM allows two (CRT_ABHA_106)", () => {
    render(<ResendOtpButton wait={0} resendsLeft={0} loading={false} onResend={vi.fn()} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText(/cannot be sent again/)).toBeInTheDocument();
  });
});

describe("ABHA enrolment consent", () => {
  it("is ABDM's published text, version 1.4 (CRT_ABHA_102)", () => {
    expect(ABHA_ENROL_CONSENT.startsWith("I, hereby declare that I am voluntarily sharing")).toBe(
      true,
    );
    expect(ABHA_ENROL_CONSENT).toContain("as per provisions of Aadhaar Act and Regulations.");
    expect(ABHA_ENROL_CONSENT_VERSION).toBe("1.4");
  });
});
