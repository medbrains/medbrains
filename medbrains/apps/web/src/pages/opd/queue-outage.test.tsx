import { QueryCache, QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@/test/test-utils";

/**
 * The waiting room must not be drawn as empty when the read failed.
 *
 * `data: queue = []` means an outage and an empty clinic produce the same
 * array, and DataTable renders its empty state for any zero-row list. On the
 * OPD queue — the busiest screen on the outpatient path — that tells the desk
 * nobody is waiting, which is a thing they act on by sending people home.
 *
 * A plain reassignable behaviour rather than a vi.fn(): a rejected promise
 * stored in mock.results is reported as unhandled even when the component
 * handled it.
 */
let listQueue: () => Promise<unknown[]> = async () => [];

vi.mock("@medbrains/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@medbrains/api")>();
  return {
    ...actual,
    api: {
      ...actual.api,
      listQueue: () => listQueue(),
      listDepartments: async () => [],
      listAppointments: async () => [],
      // DoctorSearchSelect runs its own query inside this page and calls
      // .filter on the result, so an unstubbed one crashes the render before
      // anything under test appears.
      listDoctors: async () => [],
    },
  };
});
vi.mock("@medbrains/stores", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@medbrains/stores")>()),
  useHasPermission: () => true,
}));
vi.mock("@/hooks/useRequirePermission", () => ({ useRequirePermission: () => {} }));
// `t` is called both as t(key) and t(key, "fallback") and t(key, { ... }).
// Returning the second argument blindly hands an options object where the
// caller expects a string, and a filter label then fails on toLowerCase.
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: unknown) => (typeof fallback === "string" ? fallback : key),
  }),
}));

const { OpdPageInner } = await import("./page-inner");

const silentClient = () =>
  new QueryClient({
    queryCache: new QueryCache({ onError: () => {} }),
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

describe("the OPD queue when the read fails", () => {
  beforeEach(() => {
    listQueue = async () => [];
  });

  it("says the queue could not be read rather than showing an empty clinic", async () => {
    listQueue = async () => {
      throw new Error("503 upstream");
    };

    render(<OpdPageInner />, { queryClient: silentClient() });

    await waitFor(() => expect(screen.getByText("queue.unavailable")).toBeInTheDocument());
  });

  it("shows no such warning when the clinic is genuinely empty", async () => {
    render(<OpdPageInner />, { queryClient: silentClient() });

    await waitFor(() => expect(screen.queryByText("queue.unavailable")).not.toBeInTheDocument());
  });

  /** A queue row as the server sends it, with its clinical fields cleared. */
  const row = (id: string, access: string) => ({
    id,
    encounter_id: `e-${id}`,
    patient_id: `p-${id}`,
    token_number: 1,
    token_code: `T-${id}`,
    status: "waiting",
    kind: "primary",
    has_vitals: false,
    patient_name: `Patient ${id}`,
    uhid: `UH-${id}`,
    chief_complaint: null,
    access,
  });

  it("tells a withheld complaint and an unchecked one from one never written", async () => {
    listQueue = async () => [row("1", "withheld"), row("2", "unknown"), row("3", "allowed")];

    render(<OpdPageInner />, { queryClient: silentClient() });

    await waitFor(() => expect(screen.getByText("Outside your care")).toBeInTheDocument());
    expect(screen.getByText("Couldn't check access")).toBeInTheDocument();
    expect(screen.getByText("Not recorded")).toBeInTheDocument();
    expect(screen.getByText("access.uncheckedNotice")).toBeInTheDocument();
    expect(screen.getByText("access.withheldNotice")).toBeInTheDocument();
  });
});
