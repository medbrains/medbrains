import { ApiError } from "@medbrains/api";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { BillingSettingsTab } from "./settings";

const held = vi.hoisted(() => new Set<string>());
vi.mock("@medbrains/stores", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@medbrains/stores")>()),
  useHasPermission: (code: string) => held.has(code),
  useHasAnyPermission: (codes: string[]) => codes.some((c) => held.has(c)),
}));

const service = vi.hoisted(() => ({
  getTenantSettings: vi.fn(),
  getBillingPaymentSettings: vi.fn(),
  updateTenantSetting: vi.fn(),
  updateBillingPaymentSettings: vi.fn(),
}));
vi.mock("@/services/billing.service", () => ({ billingService: service }));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("@/components/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/ui")>()),
  toast,
}));

// The tab's other sections load their own data; this file is about the
// settings block, so they render nothing here.
vi.mock("./lanes-settings", () => ({ BillingLanesSettings: () => null }));
vi.mock("./exchange-rates-section", () => ({ ExchangeRatesSection: () => null }));
vi.mock("./NonPayablesCard", () => ({ NonPayablesCard: () => null }));
vi.mock("./RevisitWindowCard", () => ({ RevisitWindowCard: () => null }));
vi.mock("./PreauthAlertThresholdCard", () => ({ PreauthAlertThresholdCard: () => null }));
vi.mock("./PaymentLinkSettingsCard", () => ({ PaymentLinkSettingsCard: () => null }));

const READ = "admin.settings.read";
const MANAGE = "admin.settings.general.manage";
const PAY_VIEW = "billing.payment_settings.view";
const PAY_MANAGE = "billing.payment_settings.manage";

const GSTIN = { key: "gst_number", value: "33AABCU9603R1ZM", category: "billing" };

beforeEach(() => {
  held.clear();
  for (const fn of [...Object.values(service), ...Object.values(toast)]) fn.mockReset();
});

describe("billing settings when a read fails", () => {
  it("shows the fault, not blank fields that would overwrite the GSTIN", async () => {
    for (const code of [READ, MANAGE]) held.add(code);
    service.getTenantSettings.mockRejectedValue(new ApiError("boom", 500));
    render(<BillingSettingsTab />);
    expect(await screen.findByText("Billing settings did not load")).toBeInTheDocument();
    expect(screen.queryByLabelText("GSTIN")).not.toBeInTheDocument();
    expect(screen.queryByText("Auto-Billing")).not.toBeInTheDocument();
    expect(service.updateTenantSetting).not.toHaveBeenCalled();
  });

  it("shows the UPI ID's fault instead of an empty UPI ID", async () => {
    for (const code of [READ, MANAGE, PAY_VIEW, PAY_MANAGE]) held.add(code);
    service.getTenantSettings.mockResolvedValue([GSTIN]);
    service.getBillingPaymentSettings.mockRejectedValue(new ApiError("boom", 500));
    render(<BillingSettingsTab />);
    expect(
      await screen.findByText("The UPI ID and payment link terms did not load"),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("UPI ID")).not.toBeInTheDocument();
    expect(screen.getByLabelText("GSTIN")).toHaveValue("33AABCU9603R1ZM");
  });

  it("still saves a GSTIN once the settings have loaded", async () => {
    for (const code of [READ, MANAGE]) held.add(code);
    service.getTenantSettings.mockResolvedValue([GSTIN]);
    service.updateTenantSetting.mockResolvedValue({});
    render(<BillingSettingsTab />);
    const field = await screen.findByLabelText("GSTIN");
    const user = userEvent.setup();
    await user.clear(field);
    await user.type(field, "33AAAAA0000A1Z5");
    await user.tab();
    await waitFor(() =>
      expect(service.updateTenantSetting).toHaveBeenCalledWith({
        category: "billing",
        key: "gst_number",
        value: "33AAAAA0000A1Z5",
      }),
    );
  });
});

describe("saving billing settings", () => {
  it("confirms a UPI ID change and that management was told", async () => {
    for (const code of [READ, MANAGE, PAY_VIEW, PAY_MANAGE]) held.add(code);
    service.getTenantSettings.mockResolvedValue([GSTIN]);
    service.getBillingPaymentSettings.mockResolvedValue({ upi_vpa: "old@okaxis" });
    service.updateBillingPaymentSettings.mockResolvedValue({ upi_vpa: "new@okaxis" });
    render(<BillingSettingsTab />);
    const field = await screen.findByLabelText(/UPI ID/);
    const user = userEvent.setup();
    await user.clear(field);
    await user.type(field, "new@okaxis");
    await user.tab();
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Management has been told of the change.", {
        title: "UPI ID saved",
      }),
    );
    expect(service.updateBillingPaymentSettings).toHaveBeenCalledWith({ upi_vpa: "new@okaxis" });
  });

  it("says why a setting was refused, not just that it failed", async () => {
    for (const code of [READ, MANAGE]) held.add(code);
    service.getTenantSettings.mockResolvedValue([GSTIN]);
    service.updateTenantSetting.mockRejectedValue(new ApiError("GSTIN must be 15 characters", 422));
    render(<BillingSettingsTab />);
    const field = await screen.findByLabelText("GSTIN");
    const user = userEvent.setup();
    await user.type(field, "X");
    await user.tab();
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("GSTIN must be 15 characters", {
        title: "Setting not saved",
      }),
    );
  });
});
