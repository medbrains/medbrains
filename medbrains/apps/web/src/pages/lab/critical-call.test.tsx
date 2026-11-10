import type { LabCriticalAlert } from "@medbrains/types";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/test-utils";

/**
 * The critical-value call record on the lab order: every documented call is
 * shown, a read-back that did not match says so, and another call can always
 * be recorded.
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
  calls: [],
  ...over,
});

describe("the critical-value call record", () => {
  it("offers to record the call until one is documented", () => {
    render(<CriticalCall alert={alert()} />);
    expect(screen.getByRole("button", { name: "Record call" })).toBeInTheDocument();
  });

  it("shows a mismatched read-back and a blocked escalation in words", () => {
    render(
      <CriticalCall
        alert={alert({
          escalation_blocked_reason: "Escalation not sent: SMS is not set up",
          calls: [
            {
              id: "c-1",
              alert_id: "a-1",
              called_by: "u",
              received_by: "Dr Rao",
              called_at: "2026-11-07T09:10:00Z",
              attempts: 2,
              readback_value: "9.6",
              readback_confirmed: false,
            },
          ],
        })}
      />,
    );
    expect(screen.getByText(/Called Dr Rao/)).toHaveTextContent("DOES NOT MATCH");
    expect(screen.getByText("Escalation not sent: SMS is not set up")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Record another call" })).toBeInTheDocument();
  });
});
