import { usePermissionStore } from "@medbrains/stores";
import type { SsoProvider } from "@medbrains/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/test-utils";

/**
 * Which directory a hospital trusts is an administrator's decision: the
 * server refuses anyone else adding, removing or switching a provider, so
 * the page must not offer them the controls.
 */

const provider: SsoProvider = {
  id: "p1",
  code: "entra",
  name: "Hospital directory",
  protocol: "oidc",
  is_active: true,
  discovery_url: null,
  metadata_url: null,
  client_id: null,
  has_client_secret: false,
  group_claim: "groups",
  default_role: null,
  jit_enabled: true,
  config: {},
  created_at: "2026-11-01T10:00:00Z",
  updated_at: "2026-11-01T10:00:00Z",
};

vi.mock("@medbrains/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@medbrains/api")>();
  return { ...actual, api: { ...actual.api, listSsoProviders: async () => [provider] } };
});
vi.mock("@/hooks/useRequirePermission", () => ({ useRequirePermission: () => {} }));

const { SsoSettingsPage } = await import("./sso");

describe("sign-in providers", () => {
  beforeEach(() => usePermissionStore.getState().clearPermissions());

  it("offers a settings manager no trust controls", async () => {
    usePermissionStore.getState().setPermissions("it_admin", ["admin.settings.general.manage"]);
    render(<SsoSettingsPage />);
    expect(await screen.findByText("Hospital directory")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /add provider/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete provider" })).not.toBeInTheDocument();
    expect(screen.queryByRole("switch", { name: "Active" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Group mappings" })).toBeInTheDocument();
  });

  it("offers a hospital administrator add, delete and the on/off switch", async () => {
    usePermissionStore.getState().setPermissions("hospital_admin", []);
    render(<SsoSettingsPage />);
    expect(await screen.findByRole("button", { name: "Delete provider" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add provider/i })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Active" })).toBeInTheDocument();
  });
});
