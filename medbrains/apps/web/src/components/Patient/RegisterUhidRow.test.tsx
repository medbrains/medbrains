import type { PatientRegistrationFormInput } from "@medbrains/schemas";
import { usePermissionStore } from "@medbrains/stores";
import type { OpdNumberView } from "@medbrains/types";
import { P } from "@medbrains/types";
import type { ReactNode } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent } from "@/test/test-utils";
import { OpdNumberRow } from "./OpdNumberRow";
import { isRegisterNumber } from "./RegisterUhidRow";

const view = vi.fn<() => Promise<OpdNumberView>>();
vi.mock("@/services/patients.service", () => ({
  patientsService: { getOpdNumber: () => view() },
}));

const VIEW: OpdNumberView = {
  mode: "manual",
  scope: "patient",
  prefix: "",
  start: 1,
  allow_backdate: true,
  previous: "1042",
  next: "1043",
};

/** The registration form's context, which the row reads. */
function Form({ children }: { children: ReactNode }) {
  const form = useForm<PatientRegistrationFormInput>();
  return <FormProvider {...form}>{children}</FormProvider>;
}

beforeEach(() => {
  usePermissionStore.getState().setPermissions("receptionist", [P.PATIENTS.CREATE]);
});

describe("the number fields at registration", () => {
  it("show one field, UHID / register no., prefilled with Next, in one-number mode", async () => {
    view.mockResolvedValue({ ...VIEW, mode: "uhid", previous: "1042", next: "1043" });
    render(
      <Form>
        <OpdNumberRow />
      </Form>,
    );
    const field = await screen.findByTestId("field-register_uhid");
    expect(field).toHaveValue("1043");
    expect(screen.queryByTestId("field-opd_number")).not.toBeInTheDocument();
    await userEvent.clear(field);
    await userEvent.type(field, "12a");
    expect(field).toHaveAttribute("aria-invalid", "true");
  });

  it("keep the OPD number beside the automatic UHID otherwise", async () => {
    view.mockResolvedValue(VIEW);
    render(
      <Form>
        <OpdNumberRow />
      </Form>,
    );
    expect(await screen.findByTestId("field-opd_number")).toHaveValue("1043");
    expect(screen.queryByTestId("field-register_uhid")).not.toBeInTheDocument();
  });

  it("take digits only as a register number", () => {
    expect(isRegisterNumber("1043")).toBe(true);
    expect(isRegisterNumber("")).toBe(true);
    for (const bad of ["12a", "MB-1", "-5", "1.5"]) expect(isRegisterNumber(bad)).toBe(false);
  });
});
