import type { UhiRequest } from "@medbrains/types";
import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/test-utils";
import { UhiPaymentCell } from "./uhi-payment-cell";

const base: UhiRequest = {
  id: "r1",
  service: "teleconsultation",
  state: "confirmed",
  customer_name: "Meena",
  customer_phone: "9876500044",
  customer_abha: null,
  summary: "",
  appointment_id: null,
  ambulance_trip_id: null,
  decline_reason: null,
  confirmed_at: null,
  responded_at: null,
  updated_at: "2026-10-19T10:00:00Z",
  payment_type: "ON-ORDER",
  payment_status: "PAID",
  amount: "500.00",
  hold_expires_at: null,
  lab_order_ids: [],
  home_collection: false,
};

describe("UhiPaymentCell", () => {
  it("says paid online with the amount", () => {
    render(<UhiPaymentCell request={base} />);
    expect(screen.getByText("Paid online")).toBeInTheDocument();
    expect(screen.getByText("₹500.00")).toBeInTheDocument();
  });

  it("calls money taken for a booking that no longer stands a refund due", () => {
    render(<UhiPaymentCell request={{ ...base, state: "expired" }} />);
    expect(screen.getByText("Paid — refund due")).toBeInTheDocument();
  });

  it("never shows a missing fee as ₹0", () => {
    render(
      <UhiPaymentCell
        request={{
          ...base,
          payment_type: "ON-FULFILLMENT",
          payment_status: "NOT-PAID",
          amount: null,
        }}
      />,
    );
    expect(screen.getByText("Pay at the hospital")).toBeInTheDocument();
    expect(screen.getByText("Fee set at the hospital")).toBeInTheDocument();
  });
});
