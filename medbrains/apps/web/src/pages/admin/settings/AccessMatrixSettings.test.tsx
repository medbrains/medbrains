import type { CustomRole, SetupUser } from "@medbrains/types";
import { fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent, waitFor, within } from "@/test/test-utils";
import { AccessMatrixSettings } from "./AccessMatrixSettings";

const held = vi.hoisted(() => ({ permissions: new Set<string>() }));
const api = vi.hoisted(() => ({
  listRoles: vi.fn(),
  listUsers: vi.fn(),
  listAccessGroups: vi.fn(),
  getAccessManifest: vi.fn(),
  listAccessGroupMembers: vi.fn(),
  updateRolePermissions: vi.fn(),
  updateRoleFieldAccess: vi.fn(),
  updateUserAccessMatrix: vi.fn(),
}));

vi.mock("@medbrains/stores", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useHasPermission: (code: string) => held.permissions.has(code),
}));
vi.mock("@/services/adminAccess.service", () => ({ adminAccessService: api }));
// The editors render one row per catalogue code; a handful keeps jsdom fast
// without changing what the page does with them.
vi.mock("@medbrains/types", async (importOriginal) => {
  const types = await importOriginal<typeof import("@medbrains/types")>();
  return {
    ...types,
    PERMISSIONS: types.PERMISSIONS.filter((p) => p.code.startsWith("nurse.mar.")),
    FIELD_ACCESS_FIELDS: types.FIELD_ACCESS_FIELDS.slice(0, 3),
  };
});

const role = (id: string, code: string, permissions: string[]): CustomRole => ({
  id,
  tenant_id: "t1",
  code,
  name: `${code} role`,
  description: null,
  permissions: permissions as unknown as Record<string, unknown>,
  field_access_defaults: {},
  widget_access_defaults: {},
  is_system: true,
  is_active: true,
  created_at: "2026-11-01T00:00:00Z",
  updated_at: "2026-11-01T00:00:00Z",
});

const user = (id: string, roleCode: string, matrix: Record<string, unknown> = {}): SetupUser => ({
  id,
  tenant_id: "t1",
  username: `u_${id}`,
  email: `${id}@example.test`,
  full_name: `User ${id}`,
  role: roleCode,
  is_active: true,
  specialization: null,
  medical_registration_number: null,
  qualification: null,
  consultation_fee: null,
  department_ids: [],
  access_matrix: matrix,
  supervisor_id: null,
});

const ALL = [
  "admin.roles.list",
  "admin.roles.update",
  "admin.users.list",
  "admin.users.update",
] as const;

/** The permission segmented control for one code, found by its label row. */
function rowFor(code: string): HTMLElement {
  const cell = screen.getByText(code);
  const row = cell.closest("tr");
  if (!row) throw new Error(`no row for ${code}`);
  return row;
}

describe("AccessMatrixSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    held.permissions = new Set(ALL);
    api.listRoles.mockResolvedValue([role("r1", "nurse", ["nurse.mar.view"])]);
    api.listUsers.mockResolvedValue([user("u1", "nurse")]);
    api.listAccessGroups.mockResolvedValue([]);
    api.getAccessManifest.mockResolvedValue(null);
    api.updateRolePermissions.mockResolvedValue({});
    api.updateRoleFieldAccess.mockResolvedValue({});
    api.updateUserAccessMatrix.mockResolvedValue({});
  });

  it("shows a fault, not an empty tenant, when roles fail to load", async () => {
    api.listRoles.mockRejectedValue(new Error("502"));
    render(<AccessMatrixSettings />);
    expect(await screen.findByText("Could not load the access matrix")).toBeInTheDocument();
    expect(screen.queryByText(/No roles or users are available/)).toBeNull();
  });

  it("says so when the tenant really has no roles or users", async () => {
    api.listRoles.mockResolvedValue([]);
    api.listUsers.mockResolvedValue([]);
    render(<AccessMatrixSettings />);
    expect(await screen.findByText(/No roles or users are available/)).toBeInTheDocument();
  });

  it("saves a newly granted permission with the role's existing grants", async () => {
    render(<AccessMatrixSettings />);
    await screen.findByText("Permission Matrix");
    const row = rowFor("nurse.mar.witness");
    await userEvent.click(within(row).getByText("Grant"));
    await userEvent.click(screen.getByRole("button", { name: /Save Matrix/ }));
    await waitFor(() => expect(api.updateRolePermissions).toHaveBeenCalled());
    const [roleId, codes] = api.updateRolePermissions.mock.calls[0] as [string, string[]];
    expect(roleId).toBe("r1");
    expect(new Set(codes)).toEqual(new Set(["nurse.mar.view", "nurse.mar.witness"]));
    expect(api.updateRoleFieldAccess).toHaveBeenCalledWith("r1", {});
  });

  it("does not let a reader without admin.roles.update save or change a role", async () => {
    held.permissions = new Set(["admin.roles.list", "admin.users.list"]);
    render(<AccessMatrixSettings />);
    await screen.findByText("Permission Matrix");
    expect(screen.getByRole("button", { name: /Save Matrix/ })).toBeDisabled();
    const radio = within(rowFor("nurse.mar.witness")).getByRole("radio", { name: "Grant" });
    expect(radio).toBeDisabled();
  });

  it("does not fetch roles for a reader without admin.roles.list, and opens on users", async () => {
    held.permissions = new Set(["admin.users.list", "admin.users.update"]);
    render(<AccessMatrixSettings />);
    expect(await screen.findByRole("button", { name: /Save User Matrix/ })).toBeInTheDocument();
    expect(api.listRoles).not.toHaveBeenCalled();
  });

  it("saves a user's deny override and keeps their existing extras", async () => {
    api.listUsers.mockResolvedValue([user("u1", "nurse", { extra: ["lab.results.view"] })]);
    render(<AccessMatrixSettings />, { initialEntries: ["/?user=u1"] });
    await screen.findByRole("button", { name: /Save User Matrix/ });
    await userEvent.click(within(rowFor("nurse.mar.view")).getByText("Deny"));
    await userEvent.click(screen.getByRole("button", { name: /Save User Matrix/ }));
    await waitFor(() => expect(api.updateUserAccessMatrix).toHaveBeenCalled());
    expect(api.updateUserAccessMatrix).toHaveBeenCalledWith(
      "u1",
      expect.objectContaining({
        extra_permissions: ["lab.results.view"],
        denied_permissions: ["nurse.mar.view"],
      }),
    );
  });

  it("counts a group grant as effective access and lists the group's members", async () => {
    api.listAccessGroups.mockResolvedValue([
      {
        id: "g1",
        tenant_id: "t1",
        code: "icu_nurse",
        name: "ICU nurse",
        description: null,
        permissions: ["nurse.mar.witness"],
        is_active: true,
      },
    ]);
    api.listAccessGroupMembers.mockResolvedValue([
      { user_id: "u1", username: "u_u1", full_name: "User u1", role: "nurse", expires_at: null },
    ]);
    render(<AccessMatrixSettings />, { initialEntries: ["/?user=u1"] });
    await screen.findByRole("button", { name: /Save User Matrix/ });
    await waitFor(() =>
      expect(within(rowFor("nurse.mar.witness")).getByText("Allowed")).toBeInTheDocument(),
    );
    expect(within(rowFor("nurse.mar.administer")).getByText("Not granted")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: /Group scope/ }));
    expect(await screen.findByText("1 members")).toBeInTheDocument();
    expect(screen.getByText("User u1")).toBeInTheDocument();
  });

  it("narrows the UI coverage list to the surfaces a search names", async () => {
    render(<AccessMatrixSettings />);
    await screen.findByText("Permission Matrix");
    await userEvent.click(screen.getByRole("tab", { name: /UI coverage/ }));
    const search = await screen.findByLabelText("Surface search");
    // The surface list's count is the last "visible" badge on the tab.
    const surfaceCount = () => screen.getAllByText(/^\d+ visible$/).at(-1)?.textContent ?? "";
    expect(Number.parseInt(surfaceCount(), 10)).toBeGreaterThan(1);
    fireEvent.change(search, { target: { value: "zz-no-such-surface" } });
    await waitFor(() => expect(surfaceCount()).toBe("0 visible"));
  }, 20_000);
});
