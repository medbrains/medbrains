import { usePermissionStore } from "@medbrains/stores";
import userEvent from "@testing-library/user-event";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@/test/test-utils";

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

const L = (key: string) => `registrationForm.${key}`;
const field = (key: string) => screen.getByLabelText(new RegExp(`^${L(key)}`));
const bloodGroup = () =>
  screen.getAllByLabelText(L("aria.bloodGroup")).find((el) => el instanceof HTMLInputElement);
const follows = (a: Element, b: Element) =>
  Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
const isMarkedRequired = (key: string) =>
  screen.getByText(L(key)).querySelector(".mantine-InputWrapper-required") !== null;

describe("PatientRegisterForm — step 1 layout (owner, first standalone hospital, 2026-11-17)", () => {
  beforeEach(() => {
    departments.mockResolvedValue([
      { id: "d-1", name: "General", code: "GEN", department_type: "clinical", is_active: true },
      { id: "d-2", name: "Ortho", code: "ORT", department_type: "clinical", is_active: true },
    ]);
    act(() => usePermissionStore.getState().setPermissions("super_admin", []));
  });
  afterEach(() => act(() => usePermissionStore.getState().clearPermissions()));

  it("puts the required fields first, in typing order, ahead of the optional section", () => {
    render(<PatientRegisterForm onSubmit={vi.fn()} onCancel={vi.fn()} />);
    const order = [
      field("label.firstName"),
      field("label.lastName"),
      screen.getByTestId("picker-gender"),
      screen.getByTestId("field-age_years"),
      screen.getByTestId("field-phone"),
      screen.getByTestId("field-has_no_phone"),
      screen.getByTestId("picker-department"),
      screen.getByTestId("picker-consultant"),
      screen.getByText(L("section.moreDetails")),
      bloodGroup(),
    ];
    for (let i = 1; i < order.length; i += 1) {
      expect(follows(order[i - 1] as Element, order[i] as Element)).toBe(true);
    }
  });

  it("marks first name, sex, age and phone required, and not blood group", () => {
    render(<PatientRegisterForm onSubmit={vi.fn()} onCancel={vi.fn()} />);
    for (const key of ["label.firstName", "label.sex", "label.age", "label.phone"]) {
      expect(isMarkedRequired(key), key).toBe(true);
    }
    expect(isMarkedRequired("label.lastName")).toBe(false);
    expect(screen.queryByText(L("row.sexBloodGroup"))).not.toBeInTheDocument();
    expect(bloodGroup()).toBeDefined();
    expect(bloodGroup()).not.toBeRequired();
  });

  it("lets an unknown patient through without name, sex, age or phone, as before", async () => {
    const onSubmit = vi.fn();
    render(<PatientRegisterForm onSubmit={onSubmit} onCancel={vi.fn()} />);
    await waitFor(() => expect(departments).toHaveBeenCalled());
    await userEvent.click(screen.getByLabelText(L("aria.unknownPatient")));
    for (const key of ["label.firstName", "label.sex", "label.age", "label.phone"]) {
      expect(isMarkedRequired(key), key).toBe(false);
    }
    await userEvent.click(screen.getByTestId("picker-department"));
    await userEvent.click(await screen.findByRole("option", { name: /^General/, hidden: true }));
    await userEvent.click(screen.getByRole("button", { name: "actions.saveNow" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const [req] = onSubmit.mock.calls[0];
    expect([req.first_name, req.last_name, req.gender]).toEqual(["Unknown", "Patient", "unknown"]);
    expect(req.is_unknown_patient).toBe(true);
  }, 30_000);

  it("saves with only the required fields and the department filled", async () => {
    const onSubmit = vi.fn();
    render(<PatientRegisterForm onSubmit={onSubmit} onCancel={vi.fn()} />);
    await waitFor(() => expect(departments).toHaveBeenCalled());
    await userEvent.type(screen.getByTestId("field-first_name"), "Asha");
    await userEvent.click(screen.getByTestId("picker-gender"));
    await userEvent.click(await screen.findByRole("option", { name: /female/i, hidden: true }));
    await userEvent.type(screen.getByTestId("field-age_years"), "34");
    await userEvent.type(screen.getByTestId("field-phone"), "9876543210");
    await userEvent.click(screen.getByTestId("picker-department"));
    await userEvent.click(await screen.findByRole("option", { name: /^General/, hidden: true }));
    await userEvent.click(screen.getByRole("button", { name: "actions.saveNow" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const [req, linked] = onSubmit.mock.calls[0];
    expect(req.first_name).toBe("Asha");
    expect(req.department_id).toBe("d-1");
    expect(req.blood_group).toBeUndefined();
    expect(linked.createOpdVisit).toBe(true);
  }, 30_000);
});
