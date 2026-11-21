import { useModuleStore, usePermissionStore } from "@medbrains/stores";
import { act } from "react";
import { Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@/test/test-utils";

const PATIENT_ID = "11111111-1111-4111-8111-111111111111";
const calls = new Set<string>();

/** A service whose every method records its name and answers `answer(name)`. */
function recordingService(answer: (name: string) => unknown) {
  return new Proxy(
    {},
    {
      get: (_target, name: string) => () => {
        calls.add(name);
        return Promise.resolve(answer(name));
      },
    },
  );
}

const patient = {
  id: PATIENT_ID,
  uhid: "UH-1",
  first_name: "Asha",
  last_name: "Rao",
  phone: "9990000000",
  date_of_birth: "1980-01-01",
  gender: "female",
  category: "general",
  financial_class: "self_pay",
  is_deceased: false,
};
const invoice = { id: "inv-1", status: "draft", total_amount: "200", paid_amount: "0" };

vi.mock("@/services/patientDetail.service", () => ({
  patientDetailService: recordingService((name) => {
    if (name === "getPatient") return patient;
    if (name === "listPatientInvoices") return [invoice];
    if (name === "listPatientRadiologyOrders" || name === "listPatientPharmacyOrders") {
      return { orders: [] };
    }
    if (name === "listPatientAdmissions") return { admissions: [] };
    return [];
  }),
}));
vi.mock("@/services/patients.service", () => ({
  patientsService: recordingService(() => ({
    patient_id: PATIENT_ID,
    outstanding_balance: "200",
    drug_allergies: [],
    known_allergies: [],
    no_known_allergies: true,
    pending_consents: [],
  })),
}));
vi.mock("@/services/billing.service", () => ({
  billingService: recordingService(() => ({ bills: [] })),
}));
vi.mock("./overview-tab", () => ({ OverviewTab: () => null }));
vi.mock("@/components/ai/AskAiButton", () => ({ AskAiButton: () => null }));
vi.mock("@/components/Print/OpdCardPrintMenu", () => ({ OpdCardPrintMenu: () => null }));
vi.mock("@/components/Patients/PatientCard", () => ({ PrintPatientCardButton: () => null }));
vi.mock("@/components/Sharing/ShareDrawer", () => ({ ShareDrawer: () => null }));
vi.mock("@/hooks/usePatientAssistantContext", () => ({ usePatientAssistantContext: () => {} }));

const { PatientDetailPageInner } = await import("./page-inner");

/** The desk's patient record, as a front-desk user who holds every code. */
function renderRecord() {
  return render(
    <Routes>
      <Route path="/patients/:id" element={<PatientDetailPageInner />} />
    </Routes>,
    { initialEntries: [`/patients/${PATIENT_ID}`] },
  );
}

describe("patient record — bricks switched off", () => {
  beforeEach(() => {
    calls.clear();
    act(() => usePermissionStore.getState().setPermissions("super_admin", []));
  });
  afterEach(() =>
    act(() => {
      useModuleStore.getState().clearModules();
      usePermissionStore.getState().clearPermissions();
    }),
  );

  it("shows Billing, Camps and the ledger, and reads them, while every brick is on", async () => {
    renderRecord();
    expect(await screen.findByRole("tab", { name: /Billing/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Camps/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Patient Ledger/ })).toBeInTheDocument();
    expect(await screen.findByText(/1 pending bill/)).toBeInTheDocument();
    expect(calls).toContain("listPatientInvoices");
    expect(calls).toContain("listErVisits");
    expect(calls).toContain("listCampRegistrations");
  });

  it("hides every Billing, Emergency and Camp control and sends none of their reads", async () => {
    act(() =>
      useModuleStore
        .getState()
        .setDisabledModules([
          "billing",
          "emergency",
          "camp",
          "lab",
          "radiology",
          "ipd",
          "pharmacy",
        ]),
    );
    renderRecord();
    expect(await screen.findByRole("tab", { name: /Overview/ })).toBeInTheDocument();
    await waitFor(() => expect(calls).toContain("getPatientContext"));
    for (const tab of [/Billing/, /Camps/, /Lab Orders/, /Imaging/, /Packages/]) {
      expect(screen.queryByRole("tab", { name: tab })).not.toBeInTheDocument();
    }
    expect(screen.queryByRole("button", { name: /Patient Ledger/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/pending bill/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Outstanding|contextSignals.outstanding/)).not.toBeInTheDocument();
    for (const read of [
      "listPatientInvoices",
      "listErVisits",
      "listCampRegistrations",
      "listPatientLabOrders",
      "listRadiologyReports",
      "listPatientAdmissions",
      "listPatientPharmacyOrders",
      "getPatientDues",
    ]) {
      expect(calls).not.toContain(read);
    }
  });

  it("opens the overview, not a hidden tab, from a #billing link while Billing is off", async () => {
    act(() => useModuleStore.getState().setDisabledModules(["billing"]));
    window.location.hash = "#billing";
    renderRecord();
    expect(
      await screen.findByRole("tab", { name: /Overview/, selected: true }),
    ).toBeInTheDocument();
    window.location.hash = "";
  });
});
