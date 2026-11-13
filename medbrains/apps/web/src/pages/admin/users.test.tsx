import { usePermissionStore } from "@medbrains/stores";
import type { SetupUser } from "@medbrains/types";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@/test/test-utils";

vi.mock("@/hooks/useRequirePermission", () => ({ useRequirePermission: () => {} }));
vi.mock("@medbrains/stores", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useHasPermission: () => true,
}));
vi.mock("./InviteUsersPanel", () => ({ InviteUsersPanel: () => null }));
vi.mock("@/components/admin/UserCreateDrawer", () => ({ UserCreateDrawer: () => null }));
vi.mock("@/components/OfflineWriteBanner", () => ({ OfflineWriteBanner: () => null }));

const user = (id: string, name: string, role: string) =>
  ({
    id,
    full_name: name,
    username: id,
    email: `${id}@h.in`,
    role,
    is_active: true,
    specialization: null,
    department_ids: [],
    access_matrix: {},
  }) as unknown as SetupUser;

vi.mock("@/services/adminAccess.service", () => ({
  adminAccessService: {
    listUsers: () =>
      Promise.resolve([
        user("u-admin", "Asha Admin", "hospital_admin"),
        user("u-nurse", "Nila Nurse", "nurse"),
      ]),
    listRoles: () => Promise.resolve([]),
    listDepartments: () => Promise.resolve([]),
  },
}));

const { UsersPage } = await import("./users");

/** The table row that holds this person's name. */
async function rowOf(name: string) {
  return (await screen.findByText(name)).closest("tr") as HTMLElement;
}

describe("the users screen, for someone who is not an administrator", () => {
  afterEach(() => act(() => usePermissionStore.setState({ userRole: null })));

  it("offers no change to an administrator's account, which the server would refuse", async () => {
    act(() => usePermissionStore.setState({ userRole: "it_manager" }));
    render(<UsersPage />);
    expect(within(await rowOf("Asha Admin")).queryByRole("button", { name: "Edit" })).toBeNull();
    expect(
      within(await rowOf("Nila Nurse")).getByRole("button", { name: "Edit" }),
    ).toBeInTheDocument();
    expect(
      within(await rowOf("Nila Nurse")).queryByRole("button", { name: "Link to sign-in" }),
    ).toBeNull();
  });

  it("lets an administrator change another administrator", async () => {
    act(() => usePermissionStore.setState({ userRole: "super_admin" }));
    render(<UsersPage />);
    expect(
      within(await rowOf("Asha Admin")).getByRole("button", { name: "Edit" }),
    ).toBeInTheDocument();
  });
});
