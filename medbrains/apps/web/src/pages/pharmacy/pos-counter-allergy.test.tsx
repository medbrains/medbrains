import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { PosCounterTab } from "./pos-counter";

const svc = vi.hoisted(() => ({
  listPatientAllergies: vi.fn(),
  getPosDaySummary: vi.fn(),
  listPosSales: vi.fn(),
  getPosPrices: vi.fn(),
  createPosSale: vi.fn(),
  cancelPharmacyPosSale: vi.fn(),
}));

const AMOXICILLIN = {
  id: "d1",
  name: "Amoxicillin 500 mg capsule",
  drug_schedule: null,
  is_controlled: false,
  current_stock: "50",
  base_price: "10",
  tax_percent: "12",
};

const CEFIXIME = {
  id: "d2",
  name: "Cefixime 200 mg tablet",
  drug_schedule: "H1",
  is_controlled: false,
  current_stock: "80",
  base_price: "8",
  tax_percent: "12",
};

vi.mock("@medbrains/stores", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useHasPermission: () => true,
  useHasAnyPermission: () => true,
  useFieldAccess: () => "edit",
}));
vi.mock("@/services/pharmacy.service", () => ({ pharmacyService: svc }));
// The payment drawer is outside this test: it pays at once with the sale total.
vi.mock("@/components/payments/collect/collect-store", () => ({
  useCollect: (
    select: (s: {
      open: (t: { sale?: { pay: (t: unknown[]) => Promise<void> } }) => void;
    }) => unknown,
  ) => select({ open: (target) => void target.sale?.pay([{ method: "cash", amount: 0 }]) }),
}));
vi.mock("@/components/DrugSearchSelect", () => ({
  DrugSearchSelect: ({ onChange }: { onChange: (id: string, drug: unknown) => void }) => (
    <>
      <button type="button" onClick={() => onChange(AMOXICILLIN.id, AMOXICILLIN)}>
        Add amoxicillin
      </button>
      <button type="button" onClick={() => onChange(CEFIXIME.id, CEFIXIME)}>
        Add Schedule H1 drug
      </button>
    </>
  ),
}));
vi.mock("./counter-patient-select", async () => ({
  CounterPatientSelect: (await import("@/test/patient-picker-stub")).PatientPicker,
}));
vi.mock("@/components/PatientSearchSelect", async () => ({
  PatientSearchSelect: (await import("@/test/patient-picker-stub")).PatientPicker,
}));
vi.mock("./counter-drawer", () => ({
  CounterDrawer: () => null,
  useActiveCashDrawer: () => ({ data: { id: "drawer" }, isError: false }),
}));
vi.mock("./counter-settings", () => ({ CounterSettings: () => null }));
vi.mock("./counter-return-policy", () => ({ CounterReturnPolicy: () => null }));
vi.mock("./pos-return-modal", () => ({ PosReturnModal: () => null }));
vi.mock("./receipt-return-lookup", () => ({ ReceiptReturnLookup: () => null }));
vi.mock("@/components/Print/PrintDocumentButton", () => ({ PrintDocumentButton: () => null }));

const REASON = "Prescriber confirmed prior tolerance";

function renderCounter() {
  return render(<PosCounterTab canView canCreate canCancel canReturn canViewPatientRecord />);
}

/** Pick a patient allergic to penicillin and put amoxicillin in the basket. */
async function allergicBasket(user: ReturnType<typeof userEvent.setup>, patient: "A" | "B") {
  await user.click(screen.getByRole("button", { name: `Pick patient ${patient}` }));
  await user.click(screen.getByRole("button", { name: "Add amoxicillin" }));
  return screen.findByLabelText(/Override reason/);
}

beforeEach(() => {
  vi.clearAllMocks();
  svc.listPatientAllergies.mockResolvedValue([
    { is_active: true, allergy_type: "drug", allergen_name: "Penicillin" },
  ]);
  svc.getPosDaySummary.mockResolvedValue(undefined);
  svc.listPosSales.mockResolvedValue([]);
  svc.getPosPrices.mockResolvedValue({
    discount_limit_percent: "10",
    lines: [{ mrp: "10", gst_rate: "12" }],
  });
  svc.createPosSale.mockResolvedValue({
    id: "s1",
    sale_number: "POS-1",
    payment_mode: "cash",
    total_amount: "10",
    change_due: "0",
    billing_invoice_id: null,
  });
});

describe("PosCounterTab patient change", () => {
  it("clears the previous patient's prescription address and prescriber", async () => {
    const user = userEvent.setup();
    svc.listPatientAllergies.mockResolvedValue([]);
    renderCounter();
    await user.click(screen.getByRole("button", { name: "Pick patient A" }));
    await user.click(screen.getByRole("button", { name: "Add Schedule H1 drug" }));
    await user.type(await screen.findByLabelText(/Patient's address/), "12 Gandhi Road");
    await user.type(screen.getByLabelText(/Prescriber/), "Dr Rao");
    await user.click(screen.getByRole("button", { name: "Pick patient B" }));
    expect(screen.getByLabelText(/Patient's address/)).toHaveValue("");
    expect(screen.getByLabelText(/Prescriber/)).toHaveValue("");
  });
});

describe("PosCounterTab allergy override", () => {
  it("does not carry an override reason from one sale to the next", async () => {
    const user = userEvent.setup();
    renderCounter();
    await user.type(await allergicBasket(user, "A"), REASON);
    await user.click(screen.getByRole("button", { name: /Take payment/ }));
    await waitFor(() => expect(svc.createPosSale).toHaveBeenCalledTimes(1));
    expect(svc.createPosSale.mock.calls[0]?.[0]).toMatchObject({ allergy_override_reason: REASON });

    const reason = await allergicBasket(user, "A");
    expect(reason).toHaveValue("");
    expect(screen.getByRole("button", { name: /Take payment/ })).toBeDisabled();
  });

  it("drops the override reason when the patient changes", async () => {
    const user = userEvent.setup();
    renderCounter();
    await user.type(await allergicBasket(user, "A"), REASON);
    await user.click(screen.getByRole("button", { name: "Pick patient B" }));
    expect(await screen.findByLabelText(/Override reason/)).toHaveValue("");
    expect(screen.getByRole("button", { name: /Take payment/ })).toBeDisabled();
  });
});
