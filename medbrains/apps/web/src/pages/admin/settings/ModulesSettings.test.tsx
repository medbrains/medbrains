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

  it("switches IPD off at once when no listed app that needs it is on", async () => {
    service.listModules.mockResolvedValue(SMALL);
    render(<ModulesSettings />);
    await userEvent.click(await screen.findByRole("switch", { name: "IPD / Inpatient: on" }));
    await waitFor(() =>
      expect(service.updateModule).toHaveBeenCalledWith("ipd", { status: "disabled" }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("asks once, naming the apps that need it, and switches them off together", async () => {
    service.listModules.mockResolvedValue([
      ...SMALL,
      brick("nursing", "Nursing Station", ["registration", "ipd"]),
      { ...brick("ot", "Operation Theatre", ["registration", "ipd"]), status: "available" },
    ]);
    render(<ModulesSettings />);
    await userEvent.click(await screen.findByRole("switch", { name: "IPD / Inpatient: on" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/Nursing Station/)).toBeInTheDocument();
    expect(within(dialog).queryByText(/Operation Theatre/)).not.toBeInTheDocument();
    expect(service.updateModule).not.toHaveBeenCalled();

    await userEvent.click(within(dialog).getByRole("button", { name: "Switch them off together" }));
    await waitFor(() =>
      expect(service.updateModule).toHaveBeenCalledWith("ipd", {
        status: "disabled",
        together: true,
      }),
    );
    expect(service.updateModule).toHaveBeenCalledTimes(1);
  });
});
