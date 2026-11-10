import type { ConnectedApp } from "@medbrains/types";
import { fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@/test/test-utils";

/**
 * Connected apps is the hospital's gate: a reviewer must see exactly what an
 * app reads and where the data goes, and only someone who may manage apps is
 * offered Approve.
 */

const app: ConnectedApp = {
  id: "a1",
  client_id: "mbapp_000000000000000000000001",
  secret_prefix: "mbcs_a3f2c1",
  name: "Ward census sync",
  publisher: "Example Health Tech",
  purpose: "Reads a new patient's demographics for the bed dashboard.",
  version: "1.0.0",
  manifest: {
    manifestVersion: 1,
    kind: "service",
    name: "Ward census sync",
    purpose: "Reads a new patient's demographics for the bed dashboard.",
    publisher: { name: "Example Health Tech" },
    version: "1.0.0",
    permissions: ["patients.view"],
    reads: ["Patient"],
    events: ["patient.created"],
    dataClasses: ["routine", "sensitive"],
    sendsDataTo: [
      { name: "Bed dashboard (Mumbai)", url: "https://beds.example.dev", purpose: "Beds" },
    ],
    webhookUrl: "https://beds.example.dev/hook",
  },
  permissions: ["patients.view"],
  status: "pending",
  has_webhook: false,
  approved_at: null,
  approved_by_name: null,
  revoked_at: null,
  revoke_reason: null,
  secret_rotated_at: null,
  last_used_at: null,
  created_at: "2026-11-01T10:00:00Z",
};

const approve = vi.fn(async (_id: string) => ({ approved: true }));
const held = vi.hoisted(() => new Set<string>());

vi.mock("@medbrains/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@medbrains/api")>();
  return {
    ...actual,
    api: {
      ...actual.api,
      listConnectedApps: async () => [app],
      approveConnectedApp: (id: string) => approve(id),
    },
  };
});
vi.mock("@medbrains/stores", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@medbrains/stores")>()),
  useHasPermission: (code: string) => held.has(code),
}));
vi.mock("@/hooks/useRequirePermission", () => ({ useRequirePermission: () => {} }));

const { ConnectedAppsPage } = await import("./index");

describe("Connected apps", () => {
  beforeEach(() => {
    approve.mockClear();
    held.clear();
  });

  it("shows the privacy label: permissions, data classes and where data goes", async () => {
    render(<ConnectedAppsPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Privacy label" }));
    expect(await screen.findByText("Bed dashboard (Mumbai)")).toBeInTheDocument();
    expect(screen.getByText("https://beds.example.dev")).toBeInTheDocument();
    expect(screen.getByText("sensitive")).toBeInTheDocument();
    expect(screen.getByText(/Reads: Patient/)).toBeInTheDocument();
  });

  it("offers Approve only to someone who may manage apps", async () => {
    render(<ConnectedAppsPage />);
    await screen.findByText("Ward census sync");
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Register app" })).not.toBeInTheDocument();
  });

  it("approves a pending app for a manager", async () => {
    held.add("admin.connected_apps.manage");
    render(<ConnectedAppsPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Approve" }));
    await waitFor(() => expect(approve).toHaveBeenCalledWith("a1"));
  });
});
