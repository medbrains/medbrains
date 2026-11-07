import type { LabCriticalAlert } from "@medbrains/types";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/test-utils";

/**
 * The critical-value call record on the lab order: offered until a call is
 * documented, then shown with whether the value was read back.
 */
vi.mock("@medbrains/stores", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@medbrains/stores")>()),
  useHasPermission: () => true,
}));

const { CriticalCall } = await import("./critical-call");

const alert = (over: Partial<LabCriticalAlert> = {}): LabCriticalAlert => ({
  id: "a-1",
  tenant_id: "t",
  order_id: "o",
  result_id: "r",
  patient_id: "p",
  parameter_name: "Potassium",
  value: "6.9",
  flag: "critical_high",
  notified_to: null,
  notified_at: null,
  acknowledged_by: null,
  acknowledged_at: null,
  readback_value: null,
  readback_verified: false,
  created_at: "2026-11-07T09:00:00Z",
  escalation_tier: 0,
  escalated_at: null,
  escalation_blocked_reason: null,
  phone_called_by: null,
  phone_received_by: null,
  phone_called_at: null,
  phone_attempts: null,
  phone_readback_confirmed: null,
  ...over,
});

describe("the critical-value call record", () => {
  it("offers to record the call until one is documented", () => {
    render(<CriticalCall alert={alert()} />);
    expect(screen.getByRole("button", { name: "Record call" })).toBeInTheDocument();
  });

  it("shows a call that was not read back, and a blocked escalation, in words", () => {
    render(
      <CriticalCall
        alert={alert({
          phone_called_at: "2026-11-07T09:10:00Z",
          phone_received_by: "Dr Rao",
          phone_attempts: 2,
          phone_readback_confirmed: false,
          escalation_blocked_reason: "Escalation not sent: no phone on file",
        })}
      />,
    );
    expect(screen.getByText(/Called Dr Rao/)).toHaveTextContent("NOT read back");
    expect(screen.getByText("Escalation not sent: no phone on file")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Record call" })).not.toBeInTheDocument();
  });
});
