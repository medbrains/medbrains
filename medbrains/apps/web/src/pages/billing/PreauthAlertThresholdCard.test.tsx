import type { PreauthAlertSettings } from "@medbrains/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { PreauthAlertThresholdCard } from "./PreauthAlertThresholdCard";

const held = vi.hoisted(() => new Set<string>());
vi.mock("@medbrains/stores", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@medbrains/stores")>()),
  useHasPermission: (code: string) => held.has(code),
}));

const service = vi.hoisted(() => ({
  getPreauthAlertSettings: vi.fn(),
  updatePreauthAlertSettings: vi.fn(),
}));
vi.mock("@/services/billing.service", () => ({ billingService: service }));

const CONFIGURE = "billing.preauth_alerts.configure";

function settings(overrides: Partial<PreauthAlertSettings> = {}): PreauthAlertSettings {
  return { threshold_percent: null, default_percent: 80, invalid: false, ...overrides };
}

beforeEach(() => {
  held.clear();
  for (const fn of Object.values(service)) fn.mockReset();
});

describe("the pre-auth alert threshold on billing settings", () => {
  it("is hidden and never fetched without its permission", () => {
    render(<PreauthAlertThresholdCard />);
    expect(screen.queryByText("Pre-auth alerts")).not.toBeInTheDocument();
    expect(service.getPreauthAlertSettings).not.toHaveBeenCalled();
  });

  it("shows the default until one is saved, and saves a new share", async () => {
    held.add(CONFIGURE);
    service.getPreauthAlertSettings.mockResolvedValue(settings());
    service.updatePreauthAlertSettings.mockResolvedValue(settings({ threshold_percent: 90 }));
    render(<PreauthAlertThresholdCard />);
    const field = await screen.findByLabelText(/Warn at this share/);
    await waitFor(() => expect(field).toHaveValue("80"));
    const user = userEvent.setup();
    await user.clear(field);
    await user.type(field, "90");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(service.updatePreauthAlertSettings).toHaveBeenCalledWith({ threshold_percent: 90 }),
    );
  });

  it("shows an unreadable saved value as a fault, not as 80", async () => {
    held.add(CONFIGURE);
    service.getPreauthAlertSettings.mockResolvedValue(settings({ invalid: true }));
    render(<PreauthAlertThresholdCard />);
    expect(await screen.findByText("The saved threshold cannot be read")).toBeInTheDocument();
    expect(screen.getByLabelText(/Warn at this share/)).toHaveValue("");
  });
});
