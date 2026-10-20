import type { CollectRequest, CollectResult, PatientDues } from "@medbrains/types";
import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent, waitFor, within } from "@/test/test-utils";
import { CollectDrawer } from "./CollectDrawer";
import { useCollect } from "./collect-store";
import { DueChip } from "./DueChip";
import { bill } from "./test-fixtures";

const billing = vi.hoisted(() => ({
  getPatientDues: vi.fn(),
  collectPayment: vi.fn(),
  listAdvances: vi.fn(),
  getReceiptPrintData: vi.fn(),
  adjustAdvance: vi.fn(),
}));
vi.mock("@/services/billing.service", () => ({ billingService: billing }));
vi.mock("@/services/payments.service", () => ({
  paymentsService: {
    listPaymentProviders: vi.fn(async () => ({ active_provider: "", providers: [] })),
    listPaymentTerminals: vi.fn(async () => []),
    listUnresolvedCardSales: vi.fn(async () => []),
  },
}));
vi.mock("@/hooks/usePatientContext", () => ({
  usePatientContext: () => ({ data: undefined }),
}));

const held = vi.hoisted(() => new Set<string>());
vi.mock("@medbrains/stores", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@medbrains/stores")>()),
  useHasAnyPermission: (codes: string[]) => codes.some((c) => held.has(c)),
  useHasPermission: (code: string) => held.has(code),
}));

const LAB_DESK = ["billing.collect.lab"];
const CASHIER = ["billing.collect.cross", "billing.payments.create"];

const DUES: PatientDues = {
  patient_id: "p1",
  amounts_hidden: false,
  total_due: "1650.00",
  collectable_due: "1200.00",
  this_department: null,
  bills: [
    bill("lab", { balance: "1200.00" }),
    bill("ph", { lanes: ["pharmacy"], balance: "450.00", can_collect: false }),
  ],
  groups: [],
  by_department: [],
};

const DONE: CollectResult = {
  collection_id: "c1",
  replayed: false,
  total_amount: "1200.00",
  station_id: null,
  shift_id: null,
  issued_invoice_ids: [],
  payments: [],
  receipts: [],
};

function sent(call = 0): CollectRequest {
  return billing.collectPayment.mock.calls[call]?.[0] as CollectRequest;
}

async function openDrawer(target: Parameters<ReturnType<typeof useCollect.getState>["open"]>[0]) {
  render(<CollectDrawer />);
  act(() => useCollect.getState().open(target));
  return screen.findByRole("dialog", { name: "Collect payment" });
}

beforeEach(() => {
  held.clear();
  vi.clearAllMocks();
  billing.getPatientDues.mockResolvedValue(DUES);
  billing.collectPayment.mockResolvedValue(DONE);
  billing.listAdvances.mockResolvedValue([]);
  act(() => useCollect.getState().close());
});

describe("the Collect drawer", () => {
  it("a lab desk collects its own dues in cash with Shift+Enter, and never sees All dues", async () => {
    for (const p of LAB_DESK) held.add(p);
    const dialog = await openDrawer({ patientId: "p1", lane: "lab" });
    await within(dialog).findByRole("button", { name: "Collect ₹1,200.00" });
    expect(within(dialog).queryByText(/All dues/)).toBeNull();
    // A lab desk without the gateway: no online checkout, no QR of its own.
    expect(within(dialog).queryByRole("radio", { name: /Online/ })).toBeNull();
    expect(within(dialog).getByRole("radio", { name: /Payment link/ })).toBeDisabled();

    await userEvent.keyboard("{Shift>}{Enter}{/Shift}");
    await waitFor(() => expect(billing.collectPayment).toHaveBeenCalledTimes(1));
    expect(sent()).toMatchObject({
      patient_id: "p1",
      scope: "department",
      lane: "lab",
      invoice_ids: ["lab"],
      tenders: [{ mode: "cash", amount: 1200 }],
    });
    expect(await within(dialog).findByText("₹1,200.00 received")).toBeInTheDocument();
  });

  it("the central cashier switches to All dues, and the amount follows", async () => {
    for (const p of CASHIER) held.add(p);
    billing.getPatientDues.mockResolvedValue({
      ...DUES,
      bills: DUES.bills.map((b) => ({ ...b, can_collect: true })),
    });
    const dialog = await openDrawer({ patientId: "p1", lane: "lab" });
    const all = await within(dialog).findByText("All dues ₹1,650.00");
    expect(within(dialog).getByText("Lab ₹1,200.00")).toBeInTheDocument();
    await userEvent.click(all);
    expect(await within(dialog).findByRole("button", { name: "Collect ₹1,650.00" })).toBeEnabled();
    expect(within(dialog).getAllByTestId("row-collect-bill")).toHaveLength(2);
  });

  it("splits: the remainder updates live and both ways go in one request", async () => {
    for (const p of LAB_DESK) held.add(p);
    const dialog = await openDrawer({ patientId: "p1", lane: "lab" });
    const amount = await within(dialog).findByRole("textbox", { name: /Amount/ });
    await userEvent.clear(amount);
    await userEvent.type(amount, "1000");
    await userEvent.click(within(dialog).getByRole("button", { name: "Add another way" }));
    expect(within(dialog).getByTestId("collect-remaining")).toHaveTextContent("₹200.00");
    await userEvent.click(within(dialog).getByRole("radio", { name: /UPI QR/ }));
    await userEvent.type(within(dialog).getByRole("textbox", { name: /UTR/ }), "UTR4885");
    await userEvent.click(within(dialog).getByRole("button", { name: "Collect ₹1,200.00" }));
    await waitFor(() => expect(billing.collectPayment).toHaveBeenCalledTimes(1));
    expect(sent().tenders).toEqual([
      { mode: "cash", amount: 1000, reference: undefined },
      { mode: "upi", amount: 200, reference: "UTR4885" },
    ]);
  });

  it("a retry after a lost answer carries the same key, so it posts once", async () => {
    for (const p of LAB_DESK) held.add(p);
    billing.collectPayment.mockRejectedValueOnce(new Error("Network error"));
    const dialog = await openDrawer({ patientId: "p1", lane: "lab" });
    const collect = await within(dialog).findByRole("button", { name: "Collect ₹1,200.00" });
    await userEvent.click(collect);
    expect(await within(dialog).findByText(/it will not be charged twice/)).toBeInTheDocument();
    await userEvent.click(collect);
    await waitFor(() => expect(billing.collectPayment).toHaveBeenCalledTimes(2));
    expect(sent(1).idempotency_key).toBe(sent(0).idempotency_key);
    expect(sent(0).idempotency_key.length).toBeGreaterThanOrEqual(8);
  });

  it("a desk asked to collect another desk's bill is told so, and cannot send it", async () => {
    for (const p of LAB_DESK) held.add(p);
    const dialog = await openDrawer({
      patientId: "p1",
      invoiceIds: ["ph"],
      focusLabel: "This bill",
    });
    expect(await within(dialog).findByText(/Another desk collects/)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Collect ₹450.00" })).toBeDisabled();
  });

  it("an outage reading the dues is an error with a retry, never 'nothing due'", async () => {
    for (const p of LAB_DESK) held.add(p);
    billing.getPatientDues.mockRejectedValue(new Error("Service unavailable"));
    const dialog = await openDrawer({ patientId: "p1", lane: "lab" });
    expect(await within(dialog).findByText("What is due could not be read")).toBeInTheDocument();
    expect(within(dialog).queryByText(/Nothing due/)).toBeNull();
    expect(within(dialog).getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});

describe("the due chip", () => {
  it("a user who collects nothing gets no chip and asks for no dues", async () => {
    render(<DueChip patientId="p1" lane="lab" />);
    await Promise.resolve();
    expect(screen.queryByTestId("due-chip")).toBeNull();
    expect(billing.getPatientDues).not.toHaveBeenCalled();
  });

  it("a desk without this department's code gets no chip", async () => {
    held.add("billing.collect.pharmacy");
    render(<DueChip patientId="p1" lane="lab" />);
    await Promise.resolve();
    expect(screen.queryByTestId("due-chip")).toBeNull();
  });

  it("the lab desk sees its department's due, and C opens the drawer", async () => {
    for (const p of LAB_DESK) held.add(p);
    render(
      <>
        <DueChip patientId="p1" lane="lab" />
        <CollectDrawer />
      </>,
    );
    expect(await screen.findByRole("button", { name: "₹1,200.00 due · Collect" })).toBeVisible();
    await userEvent.keyboard("c");
    expect(await screen.findByRole("dialog", { name: "Collect payment" })).toBeInTheDocument();
  });

  it("with only other desks' dues, it says where they are — not that nothing is owed", async () => {
    held.add("billing.collect.lab");
    billing.getPatientDues.mockResolvedValue({ ...DUES, bills: [DUES.bills[1]] });
    render(<DueChip patientId="p1" lane="lab" />);
    expect(await screen.findByText("₹450.00 due at other desks")).toBeInTheDocument();
  });

  it("dues it cannot read show as unavailable, never as nothing", async () => {
    held.add("billing.collect.lab");
    billing.getPatientDues.mockRejectedValue(new Error("down"));
    render(<DueChip patientId="p1" lane="lab" />);
    expect(await screen.findByRole("button", { name: "Dues unavailable" })).toBeInTheDocument();
  });
});
