import { QueryCache, QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@/test/test-utils";

/**
 * Arriving at consent verification from a patient's chart.
 *
 * The tab is a UUID search box. Reached from the navigation that is correct;
 * reached from a patient it is not, because the clinician has just come from
 * that patient's record and would have to retype their id. The journey action
 * `consent.verify` emits `?tab=verification&patient_id=…`, and this pins the
 * receiving half: the field is filled and the lookup has already run.
 */
const PATIENT = "11111111-2222-3333-4444-555555555555";
let summaryCalls: string[] = [];

vi.mock("@medbrains/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@medbrains/api")>();
  return {
    ...actual,
    api: {
      ...actual.api,
      getPatientConsentSummary: async (id: string) => {
        summaryCalls.push(id);
        return [];
      },
      getPatientContext: async () => null,
    },
  };
});
vi.mock("@medbrains/stores", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@medbrains/stores")>()),
  useHasPermission: () => true,
  useFieldAccess: () => "edit",
}));

const { VerificationTab } = await import("./verification-tab");

const silent = () =>
  new QueryClient({
    queryCache: new QueryCache({ onError: () => {} }),
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

describe("consent verification opened for a patient", () => {
  it("fills the patient in from the URL rather than asking for it again", async () => {
    summaryCalls = [];
    render(<VerificationTab canRevoke />, {
      queryClient: silent(),
      initialEntries: [`/consent?tab=verification&patient_id=${PATIENT}`],
    });

    const field = await screen.findByPlaceholderText(/Enter Patient ID/i);
    expect(field).toHaveValue(PATIENT);
  });

  it("has already run the lookup, so nobody has to press search", async () => {
    summaryCalls = [];
    render(<VerificationTab canRevoke />, {
      queryClient: silent(),
      initialEntries: [`/consent?tab=verification&patient_id=${PATIENT}`],
    });

    await waitFor(() => expect(summaryCalls).toContain(PATIENT));
  });

  it("still starts empty when reached from the navigation", async () => {
    summaryCalls = [];
    render(<VerificationTab canRevoke />, {
      queryClient: silent(),
      initialEntries: ["/consent"],
    });

    const field = await screen.findByPlaceholderText(/Enter Patient ID/i);
    expect(field).toHaveValue("");
    expect(summaryCalls).toHaveLength(0);
  });
});
