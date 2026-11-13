import type { DayEndClose } from "@medbrains/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/test-utils";
import { DayCloseTab } from "./day-close";

const me = vi.hoisted(() => ({ id: "cashier-1" }));
vi.mock("@medbrains/stores", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@medbrains/stores")>()),
  useHasPermission: () => true,
  useAuthStore: (select: (s: { user: { id: string } }) => unknown) => select({ user: me }),
}));

const service = vi.hoisted(() => ({
  listDayCloses: vi.fn(),
  createDayClose: vi.fn(),
  verifyDayClose: vi.fn(),
}));
vi.mock("@/services/billing.service", () => ({ billingService: service }));

/** An open close counted by `cashier`, balanced to the rupee. */
function close(id: string, cashier: string): DayEndClose {
  const zero = "0.00";
  return {
    id,
    tenant_id: "t",
    close_date: "2026-11-12",
    cashier_id: cashier,
    expected_cash: "500.00",
    actual_cash: "500.00",
    cash_difference: zero,
    total_card: zero,
    total_upi: zero,
    total_cheque: zero,
    total_bank_transfer: zero,
    total_insurance: zero,
    total_collected: "500.00",
    invoices_count: 1,
    payments_count: 1,
    refunds_total: zero,
    advances_total: zero,
    status: "open",
    counter_id: `C-${id}`,
    shift: null,
    denominations: null,
    actual_card: zero,
    actual_upi: zero,
    card_difference: zero,
    upi_difference: zero,
    verification_notes: null,
    verified_by: null,
    verified_at: null,
    notes: null,
    created_at: "2026-11-12T12:00:00Z",
    updated_at: "2026-11-12T12:00:00Z",
  };
}

beforeEach(() => {
  for (const fn of Object.values(service)) fn.mockReset();
});

describe("day close verification", () => {
  it("offers Verify on someone else's close but never on the viewer's own", async () => {
    service.listDayCloses.mockResolvedValue([close("mine", me.id), close("theirs", "cashier-2")]);
    render(<DayCloseTab />);
    expect(await screen.findByText(/C-theirs/)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /verify/i })).toHaveLength(1);
  });
});
