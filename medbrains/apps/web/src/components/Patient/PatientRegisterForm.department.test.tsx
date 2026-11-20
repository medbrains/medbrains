import { usePermissionStore } from "@medbrains/stores";
import userEvent from "@testing-library/user-event";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@/test/test-utils";

const department = (id: string, name: string) => ({
  id,
  name,
  code: name.slice(0, 3).toUpperCase(),
  department_type: "clinical",
  is_active: true,
});
const departments = vi.fn();
const none = () => Promise.resolve([]);
vi.mock("@/services/patients.service", () => ({
  patientsService: {
    listDepartments: () => departments(),
    listDoctors: none,
    listCamps: none,
    listFacilities: none,
  },
}));
vi.mock("@/services/tenantSettings.service", () => ({
  tenantSettingsService: { getTenant: () => Promise.resolve(null), geoCountries: none },
}));
vi.mock("@/services/lookups.service", () => ({ lookupsService: { listPharmacyCatalog: none } }));

const { PatientRegisterForm } = await import("./PatientRegisterForm");

const PATIENT = {
  first_name: "Asha",
  last_name: "Rao",
  phone: "9876543210",
  gender: "female",
  date_of_birth: "1990-01-01",
};

describe("PatientRegisterForm — department and OPD hand-off", () => {
  beforeEach(() => act(() => usePermissionStore.getState().setPermissions("super_admin", [])));
  afterEach(() => act(() => usePermissionStore.getState().clearPermissions()));

  it("hides the department picker in a one-department hospital and submits that department", async () => {
    departments.mockResolvedValue([department("d-gen", "General")]);
    const onSubmit = vi.fn();
    render(<PatientRegisterForm onSubmit={onSubmit} onCancel={vi.fn()} initialValues={PATIENT} />);
    // While the list loads the picker shows, as it always has.
    expect(screen.getByTestId("picker-department")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByTestId("picker-department")).not.toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: "actions.saveNow" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const [req, linked] = onSubmit.mock.calls[0];
    expect(req.department_id).toBe("d-gen");
    // Unticked by default: the page stays on the patient instead of opening OPD.
    expect(linked.openOpdAfterRegistration).toBe(false);
  }, 30_000);

  it("keeps the picker when there are several departments", async () => {
    departments.mockResolvedValue([department("d-1", "General"), department("d-2", "Ortho")]);
    render(<PatientRegisterForm onSubmit={vi.fn()} onCancel={vi.fn()} />);
    await waitFor(() => expect(departments).toHaveBeenCalled());
    expect(screen.getByTestId("picker-department")).toBeInTheDocument();
  });

  it("leaves 'open OPD after registration' unticked for a new registration", () => {
    departments.mockResolvedValue([]);
    render(<PatientRegisterForm onSubmit={vi.fn()} onCancel={vi.fn()} />);
    expect(
      screen.getByLabelText("registrationForm.aria.openOpdAfterRegistration"),
    ).not.toBeChecked();
  });
});
