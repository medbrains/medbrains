import { P } from "@medbrains/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";

const state = vi.hoisted(() => ({
  permissions: new Set<string>(),
  removed: [] as string[],
  approveError: "",
}));

vi.mock("@/hooks/useRequirePermission", () => ({ useRequirePermission: () => {} }));
vi.mock("@medbrains/stores", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useHasPermission: (code: string) => state.permissions.has(code),
}));
vi.mock("@medbrains/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@medbrains/api")>();
  return {
    ...actual,
    api: {
      ...actual.api,
      listMachines: () =>
        Promise.resolve({
          joining_paused: false,
          given_up: 0,
          dropped: [],
          waiting: [
            {
              id: "w1",
              label: "Ward 3 desk",
              app_variant: "Desktop-Workstation",
              address: "10.1.1.9",
              expires_at: "2026-11-10T10:00:00Z",
            },
          ],
          machines: [
            {
              id: "m1",
              label: "Lobby display",
              app_variant: "Desktop-Display",
              online: true,
              awaiting_confirmation: false,
              last_seen_at: null,
              screen_address: null,
            },
          ],
        }),
      removeMachine: (id: string) => {
        state.removed.push(id);
        return Promise.resolve({});
      },
      approveMachine: () => Promise.reject(new Error(state.approveError)),
    },
  };
});

const { MachinesPage } = await import("./machines");

describe("the machines screen", () => {
  beforeEach(() => {
    state.permissions = new Set([P.DEVICES.MACHINES.VIEW]);
    state.removed = [];
  });

  it("offers Remove and Approve only to those who hold them", async () => {
    render(<MachinesPage />);
    expect(await screen.findByText("Lobby display")).toBeInTheDocument();
    expect(screen.queryByTestId("btn-remove-machine")).toBeNull();
    expect(screen.queryByTestId("btn-approve-machine")).toBeNull();
  });

  it("removes a machine only after the confirmation", async () => {
    state.permissions.add(P.DEVICES.MACHINES.REMOVE);
    render(<MachinesPage />);
    await userEvent.click(await screen.findByTestId("btn-remove-machine"));
    expect(screen.getByText("Remove Lobby display?")).toBeInTheDocument();
    expect(state.removed).toEqual([]);
    await userEvent.click(screen.getByTestId("btn-confirm-remove-machine"));
    await waitFor(() => expect(state.removed).toEqual(["m1"]));
  });

  it("stops offering Approve once the server refused after wrong codes", async () => {
    state.permissions.add(P.DEVICES.MACHINES.APPROVE);
    state.approveError =
      "Three wrong codes. This request was refused; ask the person at the machine to start again.";
    render(<MachinesPage />);
    await userEvent.click(await screen.findByTestId("btn-approve-machine"));
    await userEvent.type(screen.getAllByRole("textbox")[0] as HTMLElement, "123456");
    await userEvent.click(screen.getByTestId("btn-confirm-approve-machine"));
    expect(await screen.findByText(/Three wrong codes/)).toBeInTheDocument();
    expect(screen.getByTestId("btn-confirm-approve-machine")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
  });
});
