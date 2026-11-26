import { notifications } from "@mantine/notifications";
import { ApiError } from "@medbrains/api";
import type { ModuleConfig } from "@medbrains/types";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@/test/test-utils";
import { ModulesSettings } from "./ModulesSettings";

const service = vi.hoisted(() => ({
  listModules: vi.fn(),
  getEdition: vi.fn(),
  updateModule: vi.fn(),
  applyEdition: vi.fn(),
}));
vi.mock("@/services/settingsSetup.service", () => ({ settingsSetupService: service }));
vi.mock("@/services/session.service", () => ({
  sessionService: { me: vi.fn().mockResolvedValue({ disabled_modules: [] }) },
}));

function brick(code: string, name: string, depends_on: string[] = []): ModuleConfig {
  return {
    id: code,
    tenant_id: "t",
    code,
    name,
    description: null,
    status: "enabled",
    config: {},
    depends_on,
    created_at: "",
    updated_at: "",
    background_jobs: [],
    on: true,
  };
}

const SMALL = [
  brick("registration", "Patient Registration"),
  brick("opd", "OPD / Outpatient", ["registration"]),
  brick("ipd", "IPD / Inpatient", ["registration"]),
];

describe("ModulesSettings: switching a brick off", () => {
  beforeEach(() => {
    service.updateModule.mockReset().mockResolvedValue({});
    service.getEdition.mockResolvedValue({ hospital_type: "standalone_clinic" });
  });

  it("switches IPD off at once when the server finds nothing that needs it", async () => {
    service.listModules.mockResolvedValue(SMALL);
    render(<ModulesSettings />);
    await userEvent.click(await screen.findByRole("switch", { name: "IPD / Inpatient: on" }));
    await waitFor(() =>
      expect(service.updateModule).toHaveBeenCalledWith("ipd", { status: "disabled" }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows every app the server says is on and needs it, and switches them off together", async () => {
    // Maternity has no row, so it is not in the list the screen holds; only the server knows it
    // is answering. The screen must show the server's own words, not its own guess.
    const refusal =
      "IPD / Inpatient cannot be switched off while apps that need it are on: " +
      "Nursing Station (switched on), Maternity (on, never set up). " +
      "Switch them off first, or together with it.";
    service.listModules.mockResolvedValue([
      ...SMALL,
      brick("nursing", "Nursing Station", ["registration", "ipd"]),
    ]);
    service.updateModule.mockRejectedValueOnce(new ApiError(refusal, 409, { error: "conflict" }));
    render(<ModulesSettings />);
    await userEvent.click(await screen.findByRole("switch", { name: "IPD / Inpatient: on" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/Nursing Station \(switched on\)/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Maternity \(on, never set up\)/)).toBeInTheDocument();
    expect(service.updateModule).toHaveBeenCalledTimes(1);
    expect(service.updateModule).toHaveBeenCalledWith("ipd", { status: "disabled" });

    await userEvent.click(within(dialog).getByRole("button", { name: "Switch them off together" }));
    await waitFor(() =>
      expect(service.updateModule).toHaveBeenLastCalledWith("ipd", {
        status: "disabled",
        together: true,
      }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("says so, and asks nothing, when the switch fails for another reason", async () => {
    service.listModules.mockResolvedValue(SMALL);
    service.updateModule.mockRejectedValueOnce(new ApiError("Service unavailable", 503));
    const shown = vi.spyOn(notifications, "show");
    render(<ModulesSettings />);
    await userEvent.click(await screen.findByRole("switch", { name: "IPD / Inpatient: on" }));
    await waitFor(() =>
      expect(shown).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Could not switch it", message: "Service unavailable" }),
      ),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows a brick the hospital never set up as on, and switches it off", async () => {
    // No row for Dental: the server lists it as `available` and on, because it answers its API.
    const dental = { ...brick("dental", "Dental", ["registration", "opd"]), status: "available" };
    service.listModules.mockResolvedValue([...SMALL, dental]);
    render(<ModulesSettings />);
    const toggle = await screen.findByRole("switch", { name: "Dental: on" });
    expect(screen.getAllByText("On (never set up)").length).toBeGreaterThan(0);
    await userEvent.click(toggle);
    await waitFor(() =>
      expect(service.updateModule).toHaveBeenCalledWith("dental", { status: "disabled" }),
    );
  });
});
