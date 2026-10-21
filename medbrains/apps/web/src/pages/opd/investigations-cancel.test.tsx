import { QueryCache, QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/test-utils";

/**
 * The server lets a doctor cancel only the lab orders they placed (the lab
 * desk cancels any). Offering Cancel on a colleague's order promised a
 * refusal.
 */
const ME = "doctor-me";
const PATIENT = "11111111-2222-3333-4444-555555555555";

const visitOrder = (id: string, testId: string, orderedBy: string) => ({
  id,
  patient_id: PATIENT,
  encounter_id: "enc-1",
  test_id: testId,
  ordered_by: orderedBy,
  status: "ordered",
  priority: "routine",
  notes: null,
  created_at: "2026-10-21T08:00:00Z",
});

let isLabDesk = false;

vi.mock("@medbrains/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@medbrains/api")>();
  return {
    ...actual,
    api: {
      ...actual.api,
      listLabCatalog: async () => [
        { id: "mine", code: "CBC", name: "Complete blood count" },
        { id: "theirs", code: "LFT", name: "Liver function" },
      ],
      listLabOrders: async () => ({
        orders: [visitOrder("o-mine", "mine", ME), visitOrder("o-theirs", "theirs", "doctor-b")],
        total: 2,
      }),
      listPatientLabOrders: async () => [],
      getPriorRadiologyDicomStudies: async () => [],
      listPatientRadiologyReports: async () => [],
    },
  };
});
vi.mock("@medbrains/stores", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@medbrains/stores")>()),
  useAuthStore: (select: (s: { user: { id: string } }) => unknown) => select({ user: { id: ME } }),
  useHasPermission: (code: string) => (code === "lab.orders.cancel_any" ? isLabDesk : true),
}));

const { InvestigationsTab } = await import("./investigations");

function renderTab() {
  return render(<InvestigationsTab encounterId="enc-1" patientId={PATIENT} canUpdate />, {
    queryClient: new QueryClient({
      queryCache: new QueryCache({ onError: () => {} }),
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    }),
  });
}

describe("OPD investigations — who sees Cancel", () => {
  it("offers Cancel on my own order only", async () => {
    isLabDesk = false;
    renderTab();
    await screen.findByText(/Liver function/);
    expect(screen.getAllByRole("button", { name: "Cancel order" })).toHaveLength(1);
  });

  it("offers Cancel on every order to the lab desk", async () => {
    isLabDesk = true;
    renderTab();
    await screen.findByText(/Liver function/);
    expect(screen.getAllByRole("button", { name: "Cancel order" })).toHaveLength(2);
  });
});
