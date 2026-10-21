import { QueryCache, QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent, waitFor, within } from "@/test/test-utils";

/**
 * A result must be visible wherever the clinician looks at the patient.
 *
 * Reported on production: a patient walked up to the lab desk, the test was
 * ordered there with no visit, and the doctor's investigations tab never
 * showed the result — it listed only a count, and only for this visit.
 */
const PATIENT = "11111111-2222-3333-4444-555555555555";
const VISIT_ORDER = "visit-order-1";
const WALK_IN_ORDER = "walk-in-order-1";

const patientRow = (over: Record<string, unknown>) => ({
  id: WALK_IN_ORDER,
  test_name: "Serum potassium",
  status: "verified",
  priority: "routine",
  ordered_by_name: "Lab desk",
  result_count: 1,
  collected_at: "2026-10-20T08:00:00Z",
  verified_at: "2026-10-20T09:00:00Z",
  expected_tat_minutes: null,
  rejection_reason: null,
  sample_barcode: null,
  created_at: "2026-10-20T07:55:00Z",
  updated_at: "2026-10-20T09:00:00Z",
  ...over,
});

const result = (over: Record<string, unknown>) => ({
  id: "r1",
  tenant_id: "t",
  order_id: WALK_IN_ORDER,
  parameter_name: "Potassium",
  value: "6.9",
  unit: "mmol/L",
  normal_range: "3.5-5.1",
  flag: "critical_high",
  notes: null,
  previous_value: null,
  delta_percent: null,
  is_delta_flagged: false,
  is_auto_validated: false,
  entered_by: null,
  updated_at: "2026-10-20T09:00:00Z",
  created_at: "2026-10-20T09:00:00Z",
  ...over,
});

let patientOrders: () => Promise<unknown[]> = async () => [];
let orderDetail: (id: string) => Promise<unknown> = async () => ({});
let canListLab = true;

vi.mock("@medbrains/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@medbrains/api")>();
  return {
    ...actual,
    api: {
      ...actual.api,
      listLabCatalog: async () => [],
      listLabOrders: async () => ({
        orders: [
          {
            id: VISIT_ORDER,
            patient_id: PATIENT,
            encounter_id: "enc-1",
            test_id: "cbc",
            status: "ordered",
            priority: "routine",
            notes: null,
            created_at: "2026-10-21T08:00:00Z",
          },
        ],
        total: 1,
      }),
      listPatientLabOrders: () => patientOrders(),
      getPriorRadiologyDicomStudies: async () => [],
      listPatientRadiologyReports: async () => [
        {
          report_id: "rr1",
          order_id: "ro1",
          modality: "X-ray",
          ordered_at: "2026-10-20T07:00:00Z",
          status: "final",
          findings: "No consolidation.",
          impression: "Normal chest radiograph",
          is_critical: false,
          verified_at: "2026-10-20T08:00:00Z",
          alert_id: null,
          alert_acknowledged_at: null,
        },
      ],
      getLabOrder: (id: string) => orderDetail(id),
    },
  };
});
vi.mock("@medbrains/stores", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@medbrains/stores")>()),
  useHasPermission: (code: string) => (code === "lab.orders.list" ? canListLab : true),
}));

const { InvestigationsTab } = await import("./investigations");

const silent = () =>
  new QueryClient({
    queryCache: new QueryCache({ onError: () => {} }),
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

function renderTab() {
  return render(<InvestigationsTab encounterId="enc-1" patientId={PATIENT} canUpdate={false} />, {
    queryClient: silent(),
  });
}

describe("OPD investigations — earlier and direct orders", () => {
  beforeEach(() => {
    canListLab = true;
    patientOrders = async () => [
      patientRow({ id: VISIT_ORDER, test_name: "Complete blood count", status: "ordered" }),
      patientRow({}),
    ];
    orderDetail = async () => ({
      order: { id: WALK_IN_ORDER, status: "verified" },
      results: [result({})],
      test: null,
    });
  });

  it("shows a walk-in order with no encounter, and its values when opened", async () => {
    renderTab();

    const earlier = (await screen.findByText("Serum potassium")).closest("table") as HTMLElement;
    await userEvent.click(within(earlier).getByRole("button", { name: /show results \(1\)/i }));

    expect(await within(earlier).findByText("6.9 mmol/L")).toBeInTheDocument();
    expect(within(earlier).getByText("3.5-5.1")).toBeInTheDocument();
    // The flag is words, not only a red chip.
    expect(within(earlier).getByText("Critical high")).toBeInTheDocument();
    expect(within(earlier).getByText("Verified")).toBeInTheDocument();
  });

  it("lists this visit's order under the visit, not twice", async () => {
    renderTab();
    await screen.findByText("Serum potassium");
    // The earlier/direct table holds only the walk-in; the visit order sits in
    // the visit table, keyed by test id.
    const earlier = screen.getByText("Serum potassium").closest("table") as HTMLElement;
    expect(within(earlier).queryByText("Complete blood count")).not.toBeInTheDocument();
    expect(screen.getByText("Ordered in this visit")).toBeInTheDocument();
  });

  it("shows radiology findings and impression for the patient", async () => {
    renderTab();
    expect(await screen.findByText("No consolidation.")).toBeInTheDocument();
    expect(screen.getByText("Normal chest radiograph")).toBeInTheDocument();
  });

  it("says the lab read failed rather than that nothing was ordered", async () => {
    patientOrders = async () => {
      throw new Error("503");
    };
    renderTab();
    await waitFor(() =>
      expect(screen.getByText(/lab orders could not be loaded/i)).toBeInTheDocument(),
    );
    expect(screen.queryByText(/no other lab orders/i)).not.toBeInTheDocument();
  });

  it("does not fetch patient lab orders without lab.orders.list", async () => {
    canListLab = false;
    let called = false;
    patientOrders = async () => {
      called = true;
      return [];
    };
    renderTab();
    expect(
      await screen.findByText(/do not have permission to see this patient's lab orders/i),
    ).toBeInTheDocument();
    expect(called).toBe(false);
  });
});
