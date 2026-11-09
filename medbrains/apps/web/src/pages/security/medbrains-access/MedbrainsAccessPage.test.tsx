import type { VendorAccessGrant } from "@medbrains/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { canEnd, moduleLabel, scopeOptions, statusView, timeLeft } from "./access-view";
import { GrantForm } from "./grant-form";
import { MedbrainsAccessPage } from "./MedbrainsAccessPage";

const api = vi.hoisted(() => ({
  listVendorAccessGrants: vi.fn(),
  approveVendorAccessGrant: vi.fn(),
  revokeVendorAccessGrant: vi.fn(),
  createVendorAccessGrant: vi.fn(),
  listVendorAccessEvents: vi.fn(),
}));
vi.mock("@medbrains/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@medbrains/api")>()),
  api,
}));
vi.mock("@/hooks/useRequirePermission", () => ({ useRequirePermission: () => {} }));

const held = vi.hoisted(() => new Set<string>());
vi.mock("@medbrains/stores", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@medbrains/stores")>()),
  useHasPermission: (code: string) => held.has(code),
}));

const VIEW = "security.vendor_access.view";
const APPROVE = "security.vendor_access.approve_unmasked";
const REVOKE = "security.vendor_access.revoke";

function grant(over: Partial<VendorAccessGrant> = {}): VendorAccessGrant {
  return {
    id: "g1",
    grantee_user_id: "u1",
    grantee_email: "asha@medbrains.in",
    grantee_name: "Asha Support",
    reason: "Ticket 4411: patient list slow",
    scope: ["patients", "config"],
    is_masked: true,
    expires_at: new Date(Date.now() + 2 * 3_600_000).toISOString(),
    created_by_name: "Hospital Admin",
    created_at: new Date().toISOString(),
    approved_by_name: null,
    approved_at: null,
    revoked_by_name: null,
    revoked_at: null,
    revoke_reason: null,
    status: "active",
    event_count: 3,
    ...over,
  };
}

const page = (rows: VendorAccessGrant[]) => ({
  data: rows,
  meta: { total: rows.length, page: 1, limit: 50 },
});

describe("access-view", () => {
  it("reads open access as danger and spells out waiting for approval", () => {
    expect(statusView("active").tone).toBe("danger");
    expect(statusView("pending_approval").label).toMatch(/second approver/i);
  });

  it("offers configuration only first and never a module a grant cannot open", () => {
    const options = scopeOptions();
    expect(options[0]).toEqual({ value: "config", label: "Configuration only" });
    expect(options.some((o) => o.value === "vpn")).toBe(false);
    expect(options.some((o) => o.value === "patients")).toBe(true);
    expect(moduleLabel("blood_bank")).toBe("Blood bank");
  });

  it("lets only open or waiting grants be ended, and counts time down to nothing", () => {
    expect(canEnd(grant())).toBe(true);
    expect(canEnd(grant({ status: "expired" }))).toBe(false);
    const now = new Date("2026-11-08T10:00:00Z");
    expect(timeLeft("2026-11-08T13:20:00Z", now)).toBe("3 h 20 min left");
    expect(timeLeft("2026-11-08T10:00:00Z", now)).toBeNull();
  });
});

describe("MedBrains access screen", () => {
  beforeEach(() => {
    held.clear();
    for (const fn of Object.values(api)) fn.mockReset();
  });

  it("does not fetch grants without the view permission", () => {
    render(<MedbrainsAccessPage />);
    expect(api.listVendorAccessGrants).not.toHaveBeenCalled();
  });

  it("says MedBrains has no access when nothing was given", async () => {
    held.add(VIEW);
    api.listVendorAccessGrants.mockResolvedValue(page([]));
    render(<MedbrainsAccessPage />);
    expect(await screen.findByText("MedBrains has no access")).toBeInTheDocument();
  });

  it("shows a failed read as an error, never as no access", async () => {
    held.add(VIEW);
    api.listVendorAccessGrants.mockRejectedValue(new Error("down"));
    render(<MedbrainsAccessPage />);
    await waitFor(() => expect(api.listVendorAccessGrants).toHaveBeenCalled());
    expect(await screen.findByRole("button", { name: /retry|try again/i })).toBeInTheDocument();
    expect(screen.queryByText("MedBrains has no access")).not.toBeInTheDocument();
  });

  it("shows End access only to someone who may revoke", async () => {
    held.add(VIEW);
    api.listVendorAccessGrants.mockResolvedValue(page([grant()]));
    render(<MedbrainsAccessPage />);
    expect(await screen.findByText("Open now")).toBeInTheDocument();
    expect(screen.getByText("Patient data masked")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "End access" })).not.toBeInTheDocument();
  });

  it("ends access from the confirmation dialog", async () => {
    held.add(VIEW).add(REVOKE);
    api.listVendorAccessGrants.mockResolvedValue(page([grant()]));
    api.revokeVendorAccessGrant.mockResolvedValue(grant({ status: "revoked" }));
    render(<MedbrainsAccessPage />);
    await userEvent.click(await screen.findByRole("button", { name: "End access" }));
    await userEvent.click(await screen.findByRole("button", { name: "End access now" }));
    await waitFor(() => expect(api.revokeVendorAccessGrant).toHaveBeenCalledWith("g1", undefined));
  });

  it("offers approval of unmasked access only to an approver", async () => {
    held.add(VIEW);
    const pending = grant({ status: "pending_approval", is_masked: false });
    api.listVendorAccessGrants.mockResolvedValue(page([pending]));
    const { unmount } = render(<MedbrainsAccessPage />);
    expect(await screen.findByText(/second approver/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve unmasked" })).not.toBeInTheDocument();
    unmount();

    held.add(APPROVE);
    api.approveVendorAccessGrant.mockResolvedValue(grant({ is_masked: false }));
    render(<MedbrainsAccessPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Approve unmasked" }));
    await waitFor(() => expect(api.approveVendorAccessGrant).toHaveBeenCalled());
    expect(api.approveVendorAccessGrant.mock.calls[0]?.[0]).toBe("g1");
  });
});

describe("Give access form", () => {
  it("is masked for four hours by default and warns when unmasking", async () => {
    const onSave = vi.fn();
    render(<GrantForm saving={false} error={null} onSave={onSave} />);
    expect(screen.getByRole("switch", { name: /mask patient data/i })).toBeChecked();
    expect(screen.getByRole("textbox", { name: /hours/i })).toHaveValue("4");
    await userEvent.click(screen.getByRole("switch", { name: /mask patient data/i }));
    expect(screen.getByText(/a second person must approve/i)).toBeInTheDocument();
  });

  it("refuses a request with no reason or scope, and holds hours to 72", async () => {
    const onSave = vi.fn();
    render(<GrantForm saving={false} error={null} onSave={onSave} />);
    await userEvent.type(screen.getByRole("textbox", { name: /email/i }), "asha@medbrains.in");
    const hours = screen.getByRole("textbox", { name: /hours/i });
    await userEvent.clear(hours);
    await userEvent.type(hours, "73");
    await userEvent.click(screen.getByRole("button", { name: "Give access" }));
    expect(await screen.findByText(/at least 10 characters/i)).toBeInTheDocument();
    expect(hours).toHaveValue("72");
    expect(screen.getByText(/choose at least one module/i)).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });
});
