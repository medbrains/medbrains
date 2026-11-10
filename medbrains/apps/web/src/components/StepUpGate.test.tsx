import { act } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, userEvent } from "@/test/test-utils";
import { StepUpGate } from "./StepUpGate";

/**
 * The step-up prompt shows why a password was refused in the server's words.
 * A locked account must read as locked, not as one more wrong password: the
 * doctor would otherwise keep typing into a prompt that cannot succeed.
 */
const mocks = vi.hoisted(() => {
  class ApiError extends Error {
    readonly status: number;
    readonly body: Record<string, unknown>;
    constructor(message: string, status: number, body: Record<string, unknown>) {
      super(message);
      this.status = status;
      this.body = body;
    }
  }
  return {
    ApiError,
    stepUp: vi.fn(),
    handler: { current: null as null | (() => Promise<boolean>) },
  };
});

vi.mock("@medbrains/api", () => ({
  ApiError: mocks.ApiError,
  api: { stepUp: mocks.stepUp },
  setStepUpHandler: (fn: (() => Promise<boolean>) | null) => {
    mocks.handler.current = fn;
  },
}));

describe("StepUpGate", () => {
  it("says the account is locked, in the server's words, when it is", async () => {
    const locked = "Too many wrong passwords. Try again in 15 minutes.";
    mocks.stepUp.mockRejectedValue(new mocks.ApiError(locked, 403, { detail: locked }));
    render(<StepUpGate />);
    act(() => {
      void mocks.handler.current?.();
    });
    await userEvent.type(await screen.findByLabelText("Password"), "secret");
    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(await screen.findByText(locked)).toBeInTheDocument();
    expect(screen.queryByText("Incorrect password")).not.toBeInTheDocument();
  });
});
