import { P } from "@medbrains/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent } from "@/test/test-utils";
import { NhcxPayerDirectory } from "./NhcxPayerDirectory";

/**
 * The directory fills from the NHCX registry on "Refresh from NHCX", under
 * its own permission; a registry payer without a certificate yet is not
 * flagged as unsendable, a hand-entered one is.
 */
const held = vi.hoisted(() => ({ permissions: new Set<string>() }));
const mocks = vi.hoisted(() => ({ list: vi.fn(), refresh: vi.fn() }));

vi.mock("@medbrains/stores", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useHasPermission: (code: string) => held.permissions.has(code),
}));
vi.mock("@medbrains/api", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  api: { listNhcxParticipants: mocks.list, refreshNhcxParticipants: mocks.refresh },
}));

const row = (code: string, source: "registry" | "manual") => ({
  id: code,
  participant_code: code,
  participant_name: `Payer ${code}`,
  role: "PAYER",
  is_active: true,
  has_encryption_cert: false,
  source,
  entity_type: source === "registry" ? "Pvt" : null,
  synced_at: source === "registry" ? "2026-11-15T09:00:00Z" : null,
});

describe("NhcxPayerDirectory", () => {
  beforeEach(() => {
    held.permissions = new Set([P.INSURANCE.NHCX.VIEW, P.INSURANCE.NHCX.REFRESH_DIRECTORY]);
    mocks.list.mockReset().mockResolvedValue([row("9@hcx", "manual")]);
    mocks.refresh.mockReset().mockResolvedValue({
      listed: 1,
      failed: [],
      directory: [row("1518@hcx", "registry"), row("9@hcx", "manual")],
    });
  });

  it("refreshes from NHCX and shows what the registry listed", async () => {
    render(<NhcxPayerDirectory />);
    await userEvent.click(await screen.findByRole("button", { name: "Refresh from NHCX" }));
    expect(mocks.refresh).toHaveBeenCalled();
    expect(await screen.findByText("Fetched on first send")).toBeVisible();
    expect(screen.getByText("Missing — claims cannot be sent")).toBeVisible();
  });

  it("offers no refresh without the permission", async () => {
    held.permissions = new Set([P.INSURANCE.NHCX.VIEW]);
    render(<NhcxPayerDirectory />);
    expect(await screen.findByText("Payer 9@hcx")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Refresh from NHCX" })).toBeNull();
  });
});
