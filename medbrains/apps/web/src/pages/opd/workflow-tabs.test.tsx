import { QueryCache, QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import {
  CertificatesTab,
  ChartsTab,
  ConsentsTab,
  DocketTab,
  FeedbackTab,
  ProceduresTab,
  ReferralsTab,
  RemindersTab,
  RxHistoryTab,
  TimelineTab,
} from "./workflow-tabs";

const held = vi.hoisted(() => ({ permissions: new Set<string>() }));
const opd = vi.hoisted(() => ({
  listPatientPrescriptions: vi.fn(),
  listCertificates: vi.fn(),
  createCertificate: vi.fn(),
  listProcedureConsents: vi.fn(),
  createProcedureConsent: vi.fn(),
  signProcedureConsent: vi.fn(),
  listProcedureCatalog: vi.fn(),
  listProcedureOrders: vi.fn(),
  checkDuplicateOrders: vi.fn(),
  createProcedureOrder: vi.fn(),
  cancelProcedureOrder: vi.fn(),
  listPatientReferrals: vi.fn(),
  listDepartments: vi.fn(),
  createReferral: vi.fn(),
  listReminders: vi.fn(),
  createReminder: vi.fn(),
  completeReminder: vi.fn(),
  cancelReminder: vi.fn(),
  getDoctorDocket: vi.fn(),
  listPatientVisits: vi.fn(),
  listPatientVitalsHistory: vi.fn(),
  listPatientFeedback: vi.fn(),
  createFeedback: vi.fn(),
  listPatientLabOrders: vi.fn(),
  generateDoctorDocket: vi.fn(),
}));

vi.mock("@medbrains/stores", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useHasPermission: (code: string) => held.permissions.has(code),
  useHasAnyPermission: (codes: string[]) => codes.some((c) => held.permissions.has(c)),
}));
vi.mock("@/services/opd.service", () => ({ opdService: opd }));
vi.mock("@/services/lookups.service", () => ({
  lookupsService: { listDoctors: () => Promise.resolve([]) },
}));

const PATIENT = "p1";
const ENC = "e1";

/** Render with a query cache that swallows the expected read failures. */
function renderTab(ui: React.ReactElement) {
  return render(ui, {
    queryClient: new QueryClient({
      queryCache: new QueryCache({ onError: () => {} }),
      defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
    }),
  });
}

const fail = () => Promise.reject(new Error("502"));

beforeEach(() => {
  vi.clearAllMocks();
  held.permissions = new Set();
  opd.listProcedureCatalog.mockResolvedValue([]);
  opd.listDepartments.mockResolvedValue([]);
});

describe("RxHistoryTab", () => {
  it("lists earlier prescriptions with their drugs", async () => {
    opd.listPatientPrescriptions.mockResolvedValue([
      {
        prescription: { id: "rx1", notes: null },
        items: [
          {
            id: "i1",
            drug_name: "Amlodipine",
            dosage: "5 mg",
            frequency: "OD",
            duration: "30 days",
            route: null,
          },
        ],
        encounter_date: "2026-10-01T09:00:00Z",
        doctor_name: "Rao",
      },
    ]);
    renderTab(<RxHistoryTab patientId={PATIENT} />);
    expect(await screen.findByText("Amlodipine")).toBeInTheDocument();
    expect(screen.getByText("Dr. Rao")).toBeInTheDocument();
  });

  it("says so when there are none", async () => {
    opd.listPatientPrescriptions.mockResolvedValue([]);
    renderTab(<RxHistoryTab patientId={PATIENT} />);
    expect(await screen.findByText(/No previous prescriptions/)).toBeInTheDocument();
  });

  it("shows a failed read as a fault, never as no prescriptions", async () => {
    opd.listPatientPrescriptions.mockImplementation(fail);
    renderTab(<RxHistoryTab patientId={PATIENT} />);
    expect(await screen.findByText("Prescription history could not be loaded")).toBeInTheDocument();
    expect(screen.queryByText(/No previous prescriptions/)).toBeNull();
  });
});

describe("CertificatesTab", () => {
  it("offers New Certificate only to a user who may update the visit", async () => {
    opd.listCertificates.mockResolvedValue([]);
    const { unmount } = renderTab(
      <CertificatesTab patientId={PATIENT} encounterId={ENC} canUpdate={false} />,
    );
    await waitFor(() => expect(opd.listCertificates).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: /New Certificate/ })).toBeNull();
    unmount();
    renderTab(<CertificatesTab patientId={PATIENT} encounterId={ENC} canUpdate />);
    expect(await screen.findByRole("button", { name: /New Certificate/ })).toBeInTheDocument();
  });

  it("shows a failed read as a fault", async () => {
    opd.listCertificates.mockImplementation(fail);
    renderTab(<CertificatesTab patientId={PATIENT} encounterId={ENC} canUpdate />);
    expect(await screen.findByText("Certificates could not be loaded")).toBeInTheDocument();
  });
});

describe("ConsentsTab", () => {
  const consent = (id: string, status: string) => ({
    id,
    procedure_name: `Procedure ${id}`,
    consent_type: "procedure_specific",
    status,
    consented_by_name: null,
    created_at: "2026-11-01T10:00:00Z",
  });

  it("lets only a user holding opd.consents.sign sign a pending consent", async () => {
    opd.listProcedureConsents.mockResolvedValue([
      consent("c1", "pending"),
      consent("c2", "signed"),
    ]);
    opd.signProcedureConsent.mockResolvedValue({ ...consent("c1", "signed") });
    const { unmount } = renderTab(
      <ConsentsTab patientId={PATIENT} encounterId={ENC} canUpdate={false} />,
    );
    expect(await screen.findByText("Procedure c1")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sign Consent" })).toBeNull();
    unmount();

    held.permissions = new Set(["opd.consents.sign"]);
    renderTab(<ConsentsTab patientId={PATIENT} encounterId={ENC} canUpdate={false} />);
    const sign = await screen.findAllByRole("button", { name: "Sign Consent" });
    expect(sign).toHaveLength(1);
    await userEvent.click(sign[0] as HTMLElement);
    await waitFor(() => expect(opd.signProcedureConsent).toHaveBeenCalledWith("c1"));
  });

  it("shows a failed read as a fault, not 'No consents recorded'", async () => {
    opd.listProcedureConsents.mockImplementation(fail);
    renderTab(<ConsentsTab patientId={PATIENT} encounterId={ENC} canUpdate />);
    expect(await screen.findByText("Consents could not be loaded")).toBeInTheDocument();
    expect(screen.queryByText("No consents recorded.")).toBeNull();
  });
});

describe("ProceduresTab", () => {
  const order = (id: string, status: string) => ({
    id,
    procedure_name: `Dressing ${id}`,
    procedure_code: "DRS",
    priority: "routine",
    status,
    notes: null,
    created_at: "2026-11-01T10:00:00Z",
  });

  it("offers Cancel only on open orders, and only with opd.procedures.cancel", async () => {
    opd.listProcedureOrders.mockResolvedValue([order("o1", "ordered"), order("o2", "completed")]);
    opd.cancelProcedureOrder.mockResolvedValue({});
    const { unmount } = renderTab(
      <ProceduresTab patientId={PATIENT} encounterId={ENC} canUpdate={false} />,
    );
    expect(await screen.findByText("Dressing o1")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
    unmount();

    held.permissions = new Set(["opd.procedures.cancel"]);
    renderTab(<ProceduresTab patientId={PATIENT} encounterId={ENC} canUpdate={false} />);
    const cancel = await screen.findAllByRole("button", { name: "Cancel" });
    expect(cancel).toHaveLength(1);
    await userEvent.click(cancel[0] as HTMLElement);
    await waitFor(() => expect(opd.cancelProcedureOrder).toHaveBeenCalledWith("o1"));
  });

  it("shows a failed read as a fault, not 'No procedures ordered yet'", async () => {
    opd.listProcedureOrders.mockImplementation(fail);
    renderTab(<ProceduresTab patientId={PATIENT} encounterId={ENC} canUpdate />);
    expect(await screen.findByText("Procedure orders could not be loaded")).toBeInTheDocument();
    expect(screen.queryByText("No procedures ordered yet.")).toBeNull();
  });
});

describe("TimelineTab", () => {
  beforeEach(() => {
    opd.listPatientVisits.mockResolvedValue([
      {
        id: "v1",
        encounter_date: "2026-10-01T09:00:00Z",
        created_at: "2026-10-01T09:00:00Z",
        encounter_type: "opd",
        status: "completed",
        department_name: "Medicine",
        doctor_name: "Rao",
        chief_complaint: "Fever",
        diagnosis_count: 1,
        prescription_count: 0,
        lab_order_count: 0,
      },
    ]);
    opd.listPatientPrescriptions.mockResolvedValue([]);
    opd.listCertificates.mockResolvedValue([]);
    opd.listPatientLabOrders.mockResolvedValue([
      {
        id: "l1",
        created_at: "2026-10-02T09:00:00Z",
        test_name: "CBC",
        status: "completed",
        priority: "routine",
      },
    ]);
  });

  it("merges visits and lab orders, newest first", async () => {
    renderTab(<TimelineTab patientId={PATIENT} />);
    expect(await screen.findByText("Lab: CBC")).toBeInTheDocument();
    expect(screen.getByText("OPD visit — completed")).toBeInTheDocument();
    expect(screen.getByText("2 of 2 items")).toBeInTheDocument();
    const titles = screen.getAllByText(/^(Lab: CBC|OPD visit — completed)$/);
    expect(titles.map((t) => t.textContent)).toEqual(["Lab: CBC", "OPD visit — completed"]);
  });

  it("says part of the history is missing when one source fails", async () => {
    opd.listPatientLabOrders.mockImplementation(fail);
    renderTab(<TimelineTab patientId={PATIENT} />);
    expect(
      await screen.findByText("Part of the clinical history could not be loaded"),
    ).toBeInTheDocument();
    expect(screen.getByText("OPD visit — completed")).toBeInTheDocument();
  });

  it("never says 'no clinical history' when the reads failed", async () => {
    for (const read of [
      opd.listPatientVisits,
      opd.listPatientLabOrders,
      opd.listPatientPrescriptions,
      opd.listCertificates,
    ]) {
      read.mockImplementation(fail);
    }
    renderTab(<TimelineTab patientId={PATIENT} />);
    expect(await screen.findByText("Clinical history could not be loaded")).toBeInTheDocument();
    expect(screen.queryByText(/No clinical history/)).toBeNull();
  });
});

describe("ReferralsTab", () => {
  it("creates a referral to the chosen department, for opd.referrals.create only", async () => {
    opd.listPatientReferrals.mockResolvedValue([]);
    // Only other clinical departments are offered: not the patient's own, not admin.
    opd.listDepartments.mockResolvedValue([
      { id: "d1", name: "Medicine", department_type: "clinical" },
      { id: "d2", name: "Cardiology", department_type: "clinical" },
      { id: "d3", name: "Accounts", department_type: "administrative" },
    ]);
    opd.createReferral.mockResolvedValue({ id: "ref1" });
    const { unmount } = renderTab(
      <ReferralsTab patientId={PATIENT} encounterId={ENC} departmentId="d1" />,
    );
    expect(await screen.findByText("No referrals for this patient.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /New Referral/ })).toBeNull();
    unmount();

    held.permissions = new Set(["opd.referrals.create"]);
    renderTab(<ReferralsTab patientId={PATIENT} encounterId={ENC} departmentId="d1" />);
    await userEvent.click(await screen.findByRole("button", { name: /New Referral/ }));
    const create = await screen.findByRole("button", { name: /Create Referral/ });
    expect(create).toBeDisabled();
    await userEvent.click(screen.getByRole("combobox", { name: /Refer to Department/ }));
    const cardiology = await screen.findByRole("option", { name: "Cardiology", hidden: true });
    expect(screen.queryByRole("option", { name: "Medicine", hidden: true })).toBeNull();
    expect(screen.queryByRole("option", { name: "Accounts", hidden: true })).toBeNull();
    await userEvent.click(cardiology);
    await userEvent.type(screen.getByLabelText(/Reason for Referral/), "Murmur");
    await userEvent.click(create);
    await waitFor(() => expect(opd.createReferral).toHaveBeenCalled());
    expect(opd.createReferral.mock.calls[0]?.[0]).toMatchObject({
      patient_id: PATIENT,
      encounter_id: ENC,
      to_department_id: "d2",
      reason: "Murmur",
    });
  });

  it("shows a failed read as a fault", async () => {
    opd.listPatientReferrals.mockImplementation(fail);
    renderTab(<ReferralsTab patientId={PATIENT} encounterId={ENC} departmentId="d1" />);
    expect(await screen.findByText("Referrals could not be loaded")).toBeInTheDocument();
  });
});

describe("RemindersTab", () => {
  const reminder = (id: string, status: string) => ({
    id,
    title: `Recall ${id}`,
    reminder_type: "follow_up",
    reminder_date: "2026-12-01",
    priority: "normal",
    status,
  });

  it("completes a pending reminder for a user holding opd.reminders.update", async () => {
    opd.listReminders.mockResolvedValue([reminder("r1", "pending"), reminder("r2", "completed")]);
    opd.completeReminder.mockResolvedValue({});
    held.permissions = new Set(["opd.reminders.update"]);
    renderTab(<RemindersTab patientId={PATIENT} encounterId={ENC} canUpdate />);
    const complete = await screen.findAllByRole("button", { name: "Complete" });
    expect(complete).toHaveLength(1);
    await userEvent.click(complete[0] as HTMLElement);
    await waitFor(() => expect(opd.completeReminder).toHaveBeenCalledWith("r1"));
  });

  it("hides Complete and Cancel without opd.reminders.update", async () => {
    opd.listReminders.mockResolvedValue([reminder("r1", "pending")]);
    renderTab(<RemindersTab patientId={PATIENT} encounterId={ENC} canUpdate />);
    expect(await screen.findByText("Recall r1")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Complete" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
  });

  it("shows a failed read as a fault", async () => {
    opd.listReminders.mockImplementation(fail);
    renderTab(<RemindersTab patientId={PATIENT} encounterId={ENC} canUpdate />);
    expect(await screen.findByText("Reminders could not be loaded")).toBeInTheDocument();
  });
});

describe("DocketTab", () => {
  it("shows the day's counts and lets a scheduler regenerate it", async () => {
    opd.getDoctorDocket.mockResolvedValue({
      docket_date: "2026-11-12",
      total_patients: 31,
      new_patients: 9,
      follow_ups: 22,
      referrals_made: 2,
      procedures_done: 4,
      generated_at: "2026-11-12T18:00:00Z",
    });
    opd.generateDoctorDocket.mockResolvedValue({});
    held.permissions = new Set(["opd.schedule.manage"]);
    renderTab(<DocketTab />);
    expect(await screen.findByText("31")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Generate / Refresh" }));
    await waitFor(() => expect(opd.generateDoctorDocket).toHaveBeenCalled());
  });

  it("does not offer regeneration without opd.schedule.manage", async () => {
    opd.getDoctorDocket.mockResolvedValue(null);
    renderTab(<DocketTab />);
    expect(await screen.findByText(/No docket for this date/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Generate / Refresh" })).toBeNull();
  });
});

describe("ChartsTab", () => {
  it("says so when there are no vitals to chart", async () => {
    opd.listPatientVitalsHistory.mockResolvedValue([]);
    renderTab(<ChartsTab patientId={PATIENT} />);
    expect(await screen.findByText(/No vitals history available/)).toBeInTheDocument();
  });

  it("shows a failed read as a fault, never as no vitals", async () => {
    opd.listPatientVitalsHistory.mockImplementation(fail);
    renderTab(<ChartsTab patientId={PATIENT} />);
    expect(await screen.findByText("Vitals history could not be loaded")).toBeInTheDocument();
    expect(screen.queryByText(/No vitals history available/)).toBeNull();
  });
});

describe("FeedbackTab", () => {
  it("shows each rating with its score, and Collect Feedback only to an updater", async () => {
    opd.listPatientFeedback.mockResolvedValue([
      {
        id: "f1",
        submitted_at: "2026-11-01T10:00:00Z",
        is_anonymous: true,
        rating: 2,
        wait_time_rating: 4,
        staff_rating: null,
        cleanliness_rating: null,
        overall_experience: "Long wait at billing",
        suggestions: null,
      },
    ]);
    renderTab(<FeedbackTab patientId={PATIENT} encounterId={ENC} canUpdate={false} />);
    expect(await screen.findByText("Overall: 2/5")).toBeInTheDocument();
    expect(screen.getByText("Wait: 4/5")).toBeInTheDocument();
    expect(screen.getByText("Anonymous")).toBeInTheDocument();
    expect(screen.queryByText(/Staff:/)).toBeNull();
    expect(screen.queryByRole("button", { name: /Collect Feedback/ })).toBeNull();
  });
});
