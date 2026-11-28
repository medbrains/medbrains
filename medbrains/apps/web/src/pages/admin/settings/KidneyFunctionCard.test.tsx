import { usePermissionStore } from "@medbrains/stores";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent } from "@/test/test-utils";
import { KIDNEY_DEFAULTS, KidneyFunctionForm } from "./KidneyFunctionCard";

afterEach(() => usePermissionStore.getState().clearPermissions());

describe("the kidney function rules card", () => {
  it("saves a changed outpatient window", async () => {
    usePermissionStore.getState().setPermissions("doctor", ["admin.settings.general.manage"]);
    const onSave = vi.fn();
    render(<KidneyFunctionForm value={KIDNEY_DEFAULTS} onSave={onSave} isPending={false} />);
    const outpatient = screen.getByRole("textbox", { name: /outpatients/i });
    await userEvent.clear(outpatient);
    await userEvent.type(outpatient, "14");
    await userEvent.click(screen.getByRole("button", { name: /save kidney/i }));
    expect(onSave).toHaveBeenCalledWith({ ...KIDNEY_DEFAULTS, egfr_outpatient_days: 14 });
  });

  it("will not save a window of 0 days", async () => {
    usePermissionStore.getState().setPermissions("doctor", ["admin.settings.general.manage"]);
    render(<KidneyFunctionForm value={KIDNEY_DEFAULTS} onSave={vi.fn()} isPending={false} />);
    const inpatient = screen.getByRole("textbox", { name: /inpatients/i });
    await userEvent.clear(inpatient);
    await userEvent.type(inpatient, "0");
    expect(screen.getByText("1 to 365 days")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save kidney/i })).toBeDisabled();
  });

  it("shows the rules but offers no save without the settings permission", () => {
    render(<KidneyFunctionForm value={KIDNEY_DEFAULTS} onSave={vi.fn()} isPending={false} />);
    expect(screen.getByRole("textbox", { name: /inpatients/i })).toBeDisabled();
    expect(screen.queryByRole("button", { name: /save kidney/i })).not.toBeInTheDocument();
  });
});
