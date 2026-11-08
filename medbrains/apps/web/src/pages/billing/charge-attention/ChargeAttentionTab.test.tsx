import type { ChargeAttentionItem } from "@medbrains/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent, waitFor, within } from "@/test/test-utils";
import { ChargeAttentionTab } from "./ChargeAttentionTab";

const held = vi.hoisted(() => new Set<string>());
const access = vi.hoisted(() => ({ amount: "edit" }));
vi.mock("@medbrains/stores", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@medbrains/stores")>()),
  useHasPermission: (code: string) => held.has(code),
  useFieldAccess: (code: string) => (code === "billing.amount" ? access.amount : "edit"),
}));

const service = vi.hoisted(() => ({
  listChargeAttention: vi.fn(),
  chargeAttentionSummary: vi.fn(),
  scanUnbilledOrders: vi.fn(),
  postChargeAttention: vi.fn(),
  dismissChargeAttention: vi.fn(),
  namePatientChargeAttention: vi.fn(),
}));
vi.mock("@/components/PatientSearchSelect", () => ({
  PatientSearchSelect: ({ onChange }: { onChange: (id: string) => void }) => (
    <button type="button" onClick={() => onChange("patient-9")}>
      Pick Ravi
    </button>
  ),
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
  access.amount = "edit";
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

  it("says amounts are hidden, from field access, rather than that a row has no tariff", async () => {
    for (const p of LEAKAGE) held.add(p);
    access.amount = "hidden";
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
    expect(screen.queryByText("No tariff: set price")).not.toBeInTheDocument();
  });

  it("will not post an unpriced unbilled order, and says to set a price", async () => {
    for (const p of LEAKAGE) held.add(p);
    service.listChargeAttention.mockResolvedValue({
      data: [unbilledRow({ amount: null, unit_price_override: null })],
      meta: { total: 1, page: 1, limit: 25 },
    });
    render(<ChargeAttentionTab />);
    expect(await screen.findByText("No tariff: set price")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Post charge" })).toBeDisabled();
    // Dismissing stays open to the desk.
    expect(screen.getByRole("button", { name: "Dismiss" })).toBeEnabled();
  });
});

/** A consignment knee implant the store recorded as used on no one, ₹85,000. */
function implantRow(overrides: Partial<ChargeAttentionItem> = {}): ChargeAttentionItem {
  return unbilledRow({
    id: "row-implant",
    source_module: "consumable",
    setting_module: "consignment",
    patient_id: null,
    patient_name: null,
    uhid: null,
    encounter_id: null,
    charge_code: "IMP-KNEE",
    description_override: "Consignment: Knee implant · batch K-77",
    unit_price_override: "85000.00",
    amount: "85000.00",
    reason: "implant_no_patient",
    created_by_name: "Store Keeper",
    ...overrides,
  });
}

describe("stock used on a patient and implants with no patient", () => {
  it("shows an implant with no patient as such, and will not post it until one is named", async () => {
    for (const p of LEAKAGE) held.add(p);
    service.listChargeAttention.mockResolvedValue({
      data: [implantRow()],
      meta: { total: 1, page: 1, limit: 25 },
    });
    render(<ChargeAttentionTab />);
    expect(await screen.findByText("No patient named")).toBeInTheDocument();
    expect(screen.getByText("Implant used without patient")).toBeInTheDocument();
    expect(screen.getByText(/^Stores and ward stock/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Post charge" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Name patient" })).toBeEnabled();
  });

  it("names the patient on the row through the API", async () => {
    for (const p of LEAKAGE) held.add(p);
    service.listChargeAttention.mockResolvedValue({
      data: [implantRow()],
      meta: { total: 1, page: 1, limit: 25 },
    });
    service.namePatientChargeAttention.mockResolvedValue(implantRow({ patient_id: "patient-9" }));
    const user = userEvent.setup();
    render(<ChargeAttentionTab />);
    await user.click(await screen.findByRole("button", { name: "Name patient" }));
    const dialog = await screen.findByRole("dialog");
    const confirm = within(dialog).getByRole("button", { name: "Name patient" });
    expect(confirm).toBeDisabled();
    await user.click(within(dialog).getByRole("button", { name: "Pick Ravi" }));
    await user.click(confirm);
    await waitFor(() =>
      expect(service.namePatientChargeAttention).toHaveBeenCalledWith("row-implant", {
        patient_id: "patient-9",
      }),
    );
  });

  it("offers to change a named implant's patient, and will not post a ₹0 implant", async () => {
    for (const p of LEAKAGE) held.add(p);
    service.listChargeAttention.mockResolvedValue({
      data: [
        implantRow({ patient_id: "patient-9", patient_name: "Ravi K", uhid: "UH-9" }),
        implantRow({
          id: "row-free",
          patient_id: "patient-9",
          patient_name: "Ravi K",
          uhid: "UH-9",
          unit_price_override: "0.00",
          amount: "0.00",
        }),
      ],
      meta: { total: 2, page: 1, limit: 25 },
    });
    render(<ChargeAttentionTab />);
    const change = await screen.findAllByRole("button", { name: "Change patient" });
    expect(change).toHaveLength(2);
    const posts = screen.getAllByRole("button", { name: "Post charge" });
    expect(posts[0]).toBeEnabled();
    expect(posts[1]).toBeDisabled();
  });

  it("dismisses an implant as a duplicate record only when the desk says so", async () => {
    for (const p of LEAKAGE) held.add(p);
    service.listChargeAttention.mockResolvedValue({
      data: [implantRow()],
      meta: { total: 1, page: 1, limit: 25 },
    });
    service.dismissChargeAttention.mockResolvedValue(implantRow({ status: "dismissed" }));
    const user = userEvent.setup();
    render(<ChargeAttentionTab />);
    await user.click(await screen.findByRole("button", { name: "Dismiss" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByRole("textbox", { name: /Reason/ }), "Same implant");
    await user.click(within(dialog).getByRole("checkbox", { name: /Duplicate of a record/ }));
    await user.click(within(dialog).getByRole("button", { name: "Dismiss" }));
    await waitFor(() =>
      expect(service.dismissChargeAttention).toHaveBeenCalledWith("row-implant", {
        reason: "Same implant",
        duplicate_usage: true,
      }),
    );
  });

  it("tells the desk whose registry entry an unnamed implant may be", async () => {
    for (const p of LEAKAGE) held.add(p);
    service.listChargeAttention.mockResolvedValue({
      data: [implantRow({ registry_patients: "Ravi K (UH-9)" })],
      meta: { total: 1, page: 1, limit: 25 },
    });
    render(<ChargeAttentionTab />);
    expect(
      await screen.findByText("May be the same implant as the registry entry for: Ravi K (UH-9)"),
    ).toBeInTheDocument();
  });

  it("lets the leakage desk, and only it, post stock used and never billed", async () => {
    held.add("billing.leakage.view");
    held.add("billing.charge_attention.view");
    held.add("billing.charge_attention.resolve");
    service.listChargeAttention.mockResolvedValue({
      data: [unbilledRow({ reason: "unbilled_consumption", source_module: "consumable" })],
      meta: { total: 1, page: 1, limit: 25 },
    });
    const { unmount } = render(<ChargeAttentionTab />);
    expect(await screen.findByText("Used on the patient, not billed")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Post charge" })).not.toBeInTheDocument();
    unmount();

    held.add("billing.leakage.resolve");
    render(<ChargeAttentionTab />);
    expect(await screen.findByRole("button", { name: "Post charge" })).toBeEnabled();
  });
});
