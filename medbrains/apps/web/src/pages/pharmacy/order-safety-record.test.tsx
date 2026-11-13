import type { PharmacySafetyRecordRow } from "@medbrains/types";
import { P } from "@medbrains/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/test-utils";
import { OrderSafetyRecord } from "./order-safety-record";

const state = vi.hoisted(() => ({ permissions: new Set<string>(), fetches: 0 }));

vi.mock("@medbrains/stores", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useHasPermission: (code: string) => state.permissions.has(code),
}));

const refusal: PharmacySafetyRecordRow = {
  id: "r1",
  warning_code: "schedule_x_no_witness",
  severity: "block",
  action_taken: "overridden",
  message: "Schedule X needs a second pharmacist",
  override_reason: "Witness on the phone, countersigning later",
  checked_by_name: "Asha",
  checked_at: "2026-11-09T10:00:00Z",
};

vi.mock("@/services/pharmacy.service", () => ({
  pharmacyService: {
    getPharmacyOrderSafetyRecord: () => {
      state.fetches += 1;
      return Promise.resolve([refusal]);
    },
  },
}));

describe("an order's safety record", () => {
  beforeEach(() => {
    state.permissions = new Set();
    state.fetches = 0;
  });

  it("is neither shown nor fetched without the safety-view permission", () => {
    render(<OrderSafetyRecord orderId="o1" />);
    expect(screen.queryByRole("region", { name: "Safety record" })).toBeNull();
    expect(state.fetches).toBe(0);
  });

  it("shows each finding with its outcome and the override reason", async () => {
    state.permissions = new Set([P.PHARMACY.SAFETY_VIEW]);
    render(<OrderSafetyRecord orderId="o1" />);
    expect(screen.getByRole("region", { name: "Safety record" })).toBeInTheDocument();
    expect(await screen.findByText("Schedule X needs a second pharmacist")).toBeInTheDocument();
    expect(screen.getByText("Overridden")).toBeInTheDocument();
    expect(screen.getByText(/Witness on the phone, countersigning later/)).toBeInTheDocument();
  });
});
