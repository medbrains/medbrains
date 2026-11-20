import { useModuleStore, usePermissionStore } from "@medbrains/stores";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/test-utils";

// The form's look-ups are not what is under test; empty lists keep it rendering.
const none = () => Promise.resolve([]);
vi.mock("@/services/patients.service", () => ({
  patientsService: {
    listDepartments: none,
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

const SEND_TO_OPD = "registrationForm.label.sendToOpdQueue";

describe("PatientRegisterForm — OPD hand-off", () => {
  beforeEach(() => act(() => usePermissionStore.getState().setPermissions("super_admin", [])));
  afterEach(() =>
    act(() => {
      useModuleStore.getState().clearModules();
      usePermissionStore.getState().clearPermissions();
    }),
  );

  it("offers to send the patient to the OPD queue while the EMR is on", () => {
    render(<PatientRegisterForm onSubmit={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText(SEND_TO_OPD)).toBeInTheDocument();
  });

  // Decision in docs/DECISIONS.md: with the EMR off the server refuses POST /api/opd/encounters,
  // so registration must not offer a visit it would fail to create.
  it("does not offer an OPD visit while the hospital has the EMR off", () => {
    act(() => useModuleStore.getState().setDisabledModules(["opd"]));
    render(<PatientRegisterForm onSubmit={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.queryByText(SEND_TO_OPD)).not.toBeInTheDocument();
  });
});
