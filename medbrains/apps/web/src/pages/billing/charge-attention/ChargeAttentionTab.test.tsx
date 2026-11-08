import type { ChargeAttentionItem } from "@medbrains/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/test-utils";
import { ChargeAttentionTab } from "./ChargeAttentionTab";

const held = vi.hoisted(() => new Set<string>());
vi.mock("@medbrains/stores", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@medbrains/stores")>()),
  useHasPermission: (code: string) => held.has(code),
}));

const service = vi.hoisted(() => ({
  listChargeAttention: vi.fn(),
  chargeAttentionSummary: vi.fn(),
  scanUnbilledOrders: vi.fn(),
  postChargeAttention: vi.fn(),
  dismissChargeAttention: vi.fn(),
}));
vi.mock("@/services/billing.service", () => ({ billingService: service }));

/** An unbilled CBC, ₹350, three days old, in Pathology. */
function unbilledRow(overrides: Partial<ChargeAttentionItem> = {}): ChargeAttentionItem {
  return {
    id: "row-1",
    source_module: "lab",
    setting_module: "lab",
    source_entity_id: "order-1",
    patient_id: "patient-1",
    encounter_id: "enc-1",
    charge_code: "CBC",
    quantity: 1,
    description_override: "Complete blood count",
    unit_price_override: "350.00",
    tax_percent_override: null,
    apply_concessions: false,
    reason: "unbilled_order",
    status: "open",
    invoice_id: null,
    dismiss_reason: null,
    resolved_by_name: null,
    resolved_at: null,
    created_by_name: null,
    created_at: "2026-11-08T02:00:00Z",
    patient_name: "Asha Rao",
    uhid: "UH-1",
    department_id: "dept-1",
    department_name: "Pathology",
    service_at: "2026-11-05T02:00:00Z",
    age_days: 3,
    amount: "350.00",
    ...overrides,
  };
}

const LEAKAGE = ["billing.leakage.view", "billing.leakage.resolve"];

beforeEach(() => {
  held.clear();
  for (const fn of Object.values(service)) fn.mockReset();
  service.listChargeAttention.mockResolvedValue({
    data: [unbilledRow()],
    meta: { total: 1, page: 1, limit: 25 },
  });
  service.chargeAttentionSummary.mockResolvedValue({
    open_count: 1,
    open_amount: "350.00",
    unpriced_count: 0,
  });
});

describe("orders done but never billed on the charge attention queue", () => {
  it("shows the ₹ total at the top and each row's amount, age and department", async () => {
    for (const p of LEAKAGE) held.add(p);
    render(<ChargeAttentionTab />);
    expect(await screen.findByRole("heading", { name: "₹350.00" })).toBeInTheDocument();
    expect(await screen.findByText("3 days")).toBeInTheDocument();
    expect(screen.getByText("₹350.00", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByText("Laboratory · Pathology")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Post charge" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Check for unbilled orders" })).toBeInTheDocument();
  });

  it("asks only for unbilled rows when the viewer holds only the leakage grant", async () => {
    held.add("billing.leakage.view");
    render(<ChargeAttentionTab />);
    await screen.findByText("Asha Rao");
    expect(service.listChargeAttention).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "unbilled", status: "open" }),
    );
    // Seeing is not working: no post, no dismiss, no rescan.
    expect(screen.queryByRole("button", { name: "Post charge" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Dismiss" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Check for unbilled orders" }),
    ).not.toBeInTheDocument();
  });

  it("does not let a failed-charge resolver work an unbilled row", async () => {
    held.add("billing.leakage.view");
    held.add("billing.charge_attention.view");
    held.add("billing.charge_attention.resolve");
    render(<ChargeAttentionTab />);
    await screen.findByText("Asha Rao");
    expect(screen.queryByRole("button", { name: "Post charge" })).not.toBeInTheDocument();
  });

  it("issues no fetch without either view grant", () => {
    render(<ChargeAttentionTab />);
    expect(service.listChargeAttention).not.toHaveBeenCalled();
    expect(service.chargeAttentionSummary).not.toHaveBeenCalled();
  });

  it("shows a total it could not read as a fault, never as ₹0", async () => {
    for (const p of LEAKAGE) held.add(p);
    service.chargeAttentionSummary.mockRejectedValue(new Error("503"));
    render(<ChargeAttentionTab />);
    expect(await screen.findByText("The total could not be loaded")).toBeInTheDocument();
    expect(screen.getByText(/This is not ₹0/)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "₹0.00" })).not.toBeInTheDocument();
  });

  it("says amounts are hidden rather than that a row has no tariff", async () => {
    for (const p of LEAKAGE) held.add(p);
    service.listChargeAttention.mockResolvedValue({
      data: [unbilledRow({ amount: null, unit_price_override: null })],
      meta: { total: 1, page: 1, limit: 25 },
    });
    service.chargeAttentionSummary.mockResolvedValue({
      open_count: 1,
      open_amount: null,
      unpriced_count: 0,
    });
    render(<ChargeAttentionTab />);
    expect(await screen.findByText("Hidden")).toBeInTheDocument();
    expect(screen.queryByText("No tariff")).not.toBeInTheDocument();
  });
});
