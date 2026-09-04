import { QueryCache, QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@/test/test-utils";

/**
 * The doctor's own critical values.
 *
 * The panel's one unforgivable failure would be saying "no outstanding
 * critical values on your patients" when it could not read them. A panic
 * potassium that a clinician believes has been ruled out is worse than one
 * they have not looked at yet.
 */
const alert = (over: Record<string, unknown> = {}) => ({
  id: "alert-1",
  tenant_id: "t",
  order_id: "o",
  result_id: "r",
  patient_id: "11111111-2222-3333-4444-555555555555",
  parameter_name: "Potassium",
  value: "7.1",
  flag: "critical_high",
  notified_to: null,
  notified_at: null,
  acknowledged_by: null,
  acknowledged_at: null,
  readback_value: null,
  readback_verified: false,
  created_at: "2026-09-04T09:00:00Z",
  ...over,
});

let listAlerts: () => Promise<unknown[]> = async () => [];

vi.mock("@medbrains/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@medbrains/api")>();
  return {
    ...actual,
    api: {
      ...actual.api,
      listDoctorCriticalAlerts: () => listAlerts(),
      getPatientContext: async () => null,
    },
  };
});
vi.mock("@medbrains/stores", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@medbrains/stores")>()),
  useHasPermission: () => true,
  useFieldAccess: () => "edit",
}));

const { CriticalValueInbox } = await import("./CriticalValueInbox");

const silent = () =>
  new QueryClient({
    queryCache: new QueryCache({ onError: () => {} }),
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

describe("the doctor's critical value inbox", () => {
  beforeEach(() => {
    listAlerts = async () => [];
  });

  it("says the read failed rather than that nothing is outstanding", async () => {
    listAlerts = async () => {
      throw new Error("503 upstream");
    };

    render(<CriticalValueInbox doctorId="doc-1" />, { queryClient: silent() });

    await waitFor(() => expect(screen.getByText(/could not be read/i)).toBeInTheDocument());
    expect(screen.queryByText(/No outstanding critical values/i)).not.toBeInTheDocument();
  });

  it("reports an empty inbox as empty when the read genuinely succeeded", async () => {
    render(<CriticalValueInbox doctorId="doc-1" />, { queryClient: silent() });

    await waitFor(() =>
      expect(screen.getByText(/No outstanding critical values/i)).toBeInTheDocument(),
    );
  });

  it("shows an outstanding panic value with its flag", async () => {
    listAlerts = async () => [alert()];

    render(<CriticalValueInbox doctorId="doc-1" />, { queryClient: silent() });

    await waitFor(() => expect(screen.getByText("7.1")).toBeInTheDocument());
    expect(screen.getByText("Potassium")).toBeInTheDocument();
  });

  it("hides values the doctor has already acknowledged", async () => {
    listAlerts = async () => [alert({ acknowledged_at: "2026-09-04T09:05:00Z" })];

    render(<CriticalValueInbox doctorId="doc-1" />, { queryClient: silent() });

    await waitFor(() =>
      expect(screen.getByText(/No outstanding critical values/i)).toBeInTheDocument(),
    );
  });
});
