import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/test-utils";
import { VerifyEmailBanner } from "./VerifyEmailBanner";

const me = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock("@medbrains/api/modules/auth", () => ({
  authApi: { me: () => Promise.resolve(me.value), resendVerification: vi.fn() },
}));

const user = { email: "desk@example.test", email_verified: false };

describe("the verify-your-email banner", () => {
  it("asks an unverified user to verify where the hospital can send email", async () => {
    me.value = { ...user, email_can_send: true };
    render(<VerifyEmailBanner />);
    expect(await screen.findByText("Verify your email")).toBeInTheDocument();
  });

  it("stays hidden where the hospital cannot send email", async () => {
    me.value = { ...user, email_can_send: false };
    render(<VerifyEmailBanner />);
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText("Verify your email")).not.toBeInTheDocument();
  });
});
