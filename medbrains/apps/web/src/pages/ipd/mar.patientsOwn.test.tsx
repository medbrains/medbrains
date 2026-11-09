import type { MarListRow } from "@medbrains/types";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/test-utils";
import { PATIENTS_OWN_LABEL } from "@/utils/buyOutside";

/**
 * A medicine bought outside is still on the MAR, as the patient's own with no
 * batch, so the nurse gives and charts it (DECISIONS, 2026-11-09). The chart
 * says which doses those are.
 */
vi.mock("@medbrains/stores", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@medbrains/stores")>()),
  useHasPermission: () => true,
}));
vi.mock("@/components/Signatures/SignRecordButton", () => ({ SignRecordButton: () => null }));

/** One scheduled dose of `drug`. */
function dose(id: string, drug: string, patientsOwn: boolean): MarListRow {
  return {
    id,
    tenant_id: "t",
    admission_id: "a",
    prescription_item_id: null,
    drug_name: drug,
    dose: "1 tab",
    route: "oral",
    frequency: "OD",
    scheduled_at: "2026-11-09T09:00:00Z",
    administered_at: null,
    status: "scheduled",
    administered_by: null,
    witnessed_by: null,
    barcode_verified: false,
    is_high_alert: false,
    hold_reason: null,
    refused_reason: null,
    notes: null,
    prn_reason: null,
    missed_reason: null,
    double_checked_by: null,
    batch_stock_id: null,
    batch_number: patientsOwn ? null : "B-1",
    batch_expiry: null,
    created_at: "2026-11-09T08:00:00Z",
    updated_at: "2026-11-09T08:00:00Z",
    patients_own: patientsOwn,
    is_cytotoxic: false,
  };
}

vi.mock("@/services/ipd.service", () => ({
  ipdService: {
    listMar: async () => [dose("1", "Own inhaler", true), dose("2", "Stocked", false)],
  },
}));

const { MarTab } = await import("./mar");

describe("the MAR, a patient's own medicine", () => {
  it("marks the dose brought from outside, and only that one", async () => {
    render(<MarTab admissionId="a" />);
    expect(await screen.findByText("Own inhaler")).toBeInTheDocument();
    expect(screen.getAllByText(PATIENTS_OWN_LABEL)).toHaveLength(1);
    expect(screen.getByText("Stocked")).toBeInTheDocument();
  });
});
