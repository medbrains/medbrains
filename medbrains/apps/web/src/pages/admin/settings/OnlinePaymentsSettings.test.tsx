import type { OnlineSettings, ProviderSetup } from "@medbrains/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent, waitFor, within } from "@/test/test-utils";
import { OnlinePaymentsSettings } from "./OnlinePaymentsSettings";

const service = vi.hoisted(() => ({
  getOnlineSettings: vi.fn(),
  updateOnlineSettings: vi.fn(),
  setProviderKeys: vi.fn(),
  setStationProvider: vi.fn(),
  testPaymentProvider: vi.fn(),
}));
vi.mock("@/services/payments.service", () => ({ paymentsService: service }));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("@/components/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/ui")>()),
  toast,
}));

const held = vi.hoisted(() => ({ configure: true }));
vi.mock("@medbrains/stores", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@medbrains/stores")>()),
  useHasPermission: () => held.configure,
}));

const CAPS = {
  checkout: true,
  dynamic_qr: false,
  payment_links: false,
  partial_refund: true,
  multiple_refunds: false,
  payouts: false,
  upi_collect: false,
  emi: false,
};

function provider(code: string, label: string, configured: boolean): ProviderSetup {
  return {
    provider: code,
    label,
    capabilities: CAPS,
    configured,
    missing: configured ? [] : ["client_id", "client_secret"],
    mode: configured ? "test" : null,
    source: configured ? "tenant_settings" : null,
    fields: [
      {
        name: "client_id",
        label: "App ID (client ID)",
        secret: false,
        required: true,
        set: configured,
        value: configured ? "cf-app" : null,
      },
      {
        name: "client_secret",
        label: "Secret key",
        secret: true,
        required: true,
        set: configured,
        value: null,
      },
    ],
    stand_in: false,
  };
}

const SETTINGS: OnlineSettings = {
  active_provider: "razorpay",
  fallback_provider: null,
  providers: [provider("razorpay", "Razorpay", true), provider("cashfree", "Cashfree", false)],
  stations: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  held.configure = true;
  service.getOnlineSettings.mockResolvedValue(SETTINGS);
});

describe("Online payments settings", () => {
  it("shows each provider's keys status and what it can do, never a secret", async () => {
    render(<OnlinePaymentsSettings />);
    const cashfree = await screen.findByTestId("provider-row-cashfree");
    expect(within(cashfree).getByText("Missing: client_id, client_secret")).toBeInTheDocument();
    expect(within(cashfree).getByRole("button", { name: "Test Cashfree" })).toBeDisabled();
    const razorpay = screen.getByTestId("provider-row-razorpay");
    expect(within(razorpay).getByText("Test keys set")).toBeInTheDocument();
    expect(within(razorpay).getByText("In use")).toBeInTheDocument();
    expect(within(razorpay).getByText("Checkout")).toBeInTheDocument();
  });

  it("sends only the keys typed, and refuses to save without the required ones", async () => {
    service.setProviderKeys.mockResolvedValue(provider("cashfree", "Cashfree", true));
    render(<OnlinePaymentsSettings />);
    await userEvent.click(await screen.findByRole("button", { name: "Set Cashfree keys" }));
    const dialog = await screen.findByRole("dialog", { name: "Cashfree keys" });
    await userEvent.type(within(dialog).getByLabelText(/App ID/), "cf-app");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save keys" }));
    // The secret is required until one is stored: the form does not go.
    expect(within(dialog).getByLabelText(/Secret key/)).toBeRequired();
    expect(service.setProviderKeys).not.toHaveBeenCalled();
    await userEvent.type(within(dialog).getByLabelText(/Secret key/), "s3cret");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save keys" }));
    await waitFor(() =>
      expect(service.setProviderKeys).toHaveBeenCalledWith("cashfree", {
        mode: "test",
        values: { client_id: "cf-app", client_secret: "s3cret" },
      }),
    );
  });

  it("tests a provider's keys and says what it answered", async () => {
    service.testPaymentProvider.mockResolvedValue({
      ok: false,
      message: "Razorpay is unavailable",
    });
    render(<OnlinePaymentsSettings />);
    await userEvent.click(await screen.findByRole("button", { name: "Test Razorpay" }));
    expect(service.testPaymentProvider).toHaveBeenCalledWith("razorpay", expect.anything());
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Razorpay is unavailable"));
  });

  it("without the permission it says so and asks for nothing", async () => {
    held.configure = false;
    render(<OnlinePaymentsSettings />);
    expect(screen.getByText(/Configure online payment providers/)).toBeInTheDocument();
    expect(service.getOnlineSettings).not.toHaveBeenCalled();
  });
});
