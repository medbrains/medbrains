import type { RevenueAlert } from "@medbrains/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { RevenueAlertsPanel } from "./RevenueAlertsPanel";
import { estimateDeduction, percentUsed } from "./revenue-alerts-labels";

const held = vi.hoisted(() => new Set<string>());
vi.mock("@medbrains/stores", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@medbrains/stores")>()),
  useHasPermission: (code: string) => held.has(code),
}));

const service = vi.hoisted(() => ({
  listRevenueAlerts: vi.fn(),
  requestPreauthEnhancement: vi.fn(),
  recordRoomConsent: vi.fn(),
}));
vi.mock("@/services/billing.service", () => ({ billingService: service }));

/** ₹1,00,000 approved, ₹85,000 billed, Star Health. */
function preauthRow(overrides: Partial<RevenueAlert> = {}): RevenueAlert {
  return {
    id: "alert-1",
    kind: "preauth_used_up",
    reason: "preauth_used_up",
    status: "open",
    source_entity_id: "pa-1",
    patient_id: "patient-1",
    encounter_id: "enc-1",
    patient_name: "Asha Rao",
    uhid: "UH-1",
    payer: "Star Health",
    pa_number: "PA-1",
    amount: "85000.00",
    evidence: { approved_amount: 100000, running_bill: 85000, threshold_percent: 80 },
    created_at: "2026-11-08T02:00:00Z",
    resolved_at: null,
    resolved_by_name: null,
    ...overrides,
  };
}

beforeEach(() => {
  held.clear();
  for (const fn of Object.values(service)) fn.mockReset();
  service.listRevenueAlerts.mockResolvedValue([preauthRow()]);
});

describe("pre-auths nearly used up on the TPA screen", () => {
  it("shows the approval, the share used and the bill so far", async () => {
    held.add("insurance.enhancement.view");
    render(<RevenueAlertsPanel kind="preauth_used_up" />);
    expect(await screen.findByText("Approved ₹1,00,000 · 85% used")).toBeInTheDocument();
    expect(screen.getByText("₹85,000")).toBeInTheDocument();
    expect(service.listRevenueAlerts).toHaveBeenCalledWith({ kind: "preauth_used_up" });
  });

  it("requests an enhancement for the extra amount", async () => {
    held.add("insurance.enhancement.view");
    held.add("insurance.enhancement.request");
    service.requestPreauthEnhancement.mockResolvedValue(preauthRow({ status: "actioned" }));
    render(<RevenueAlertsPanel kind="preauth_used_up" />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Request enhancement" }));
    await user.type(screen.getByLabelText(/Extra amount/), "50000");
    expect(await screen.findByText("New total asked: ₹1,50,000")).toBeInTheDocument();
    const buttons = screen.getAllByRole("button", { name: "Request enhancement" });
    await user.click(buttons[buttons.length - 1] as HTMLElement);
    await waitFor(() =>
      expect(service.requestPreauthEnhancement).toHaveBeenCalledWith("alert-1", {
        additional_amount: 50000,
        note: undefined,
      }),
    );
  });

  it("offers no action to a viewer who may not request", async () => {
    held.add("insurance.enhancement.view");
    render(<RevenueAlertsPanel kind="preauth_used_up" />);
    await screen.findByText("Asha Rao");
    expect(screen.queryByRole("button", { name: "Request enhancement" })).not.toBeInTheDocument();
  });

  it("is hidden and never fetched without the view permission", () => {
    render(<RevenueAlertsPanel kind="preauth_used_up" />);
    expect(screen.queryByText("Pre-auths nearly used up")).not.toBeInTheDocument();
    expect(service.listRevenueAlerts).not.toHaveBeenCalled();
  });

  it("shows an unreadable approval as a fault, not as fine", async () => {
    held.add("insurance.enhancement.view");
    service.listRevenueAlerts.mockResolvedValue([
      preauthRow({ reason: "preauth_approval_unknown", evidence: { approved_amount: null } }),
    ]);
    render(<RevenueAlertsPanel kind="preauth_used_up" />);
    expect(await screen.findByText("Approval amount unknown")).toBeInTheDocument();
  });

  it("shows a failed load as a fault, not as an empty list", async () => {
    held.add("insurance.enhancement.view");
    service.listRevenueAlerts.mockImplementation(async () => {
      throw new Error("Service unavailable");
    });
    render(<RevenueAlertsPanel kind="preauth_used_up" />);
    expect(await screen.findByText("This didn't load")).toBeInTheDocument();
    expect(screen.queryByText("No pre-auth is near its approved amount")).not.toBeInTheDocument();
  });
});

describe("the numbers behind the alerts", () => {
  it("cuts every room-linked rupee in proportion", () => {
    // ₹8,000 room under ₹5,000: 62.5% payable, so ₹37,500 of ₹1,00,000 is cut.
    expect(estimateDeduction(100000, 0.625)).toBe(37500);
  });

  it("reads the share used from the evidence, or says nothing", () => {
    expect(percentUsed(preauthRow())).toBe(85);
    expect(percentUsed(preauthRow({ evidence: { approved_amount: null } }))).toBeNull();
  });
});
