import { QueryCache, QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@/test/test-utils";

/**
 * The camp board is built entirely from counters: `camp_board` selects
 * FROM camp_department_counters JOIN departments, so a camp with none yields
 * an empty board however complete the TV screen reading it is.
 *
 * Two things this tab has to get right, both about not lying by omission.
 */
const CAMP = "44444444-4444-4444-4444-444444444444";

let listCampCounters: () => Promise<unknown[]> = async () => [];

vi.mock("@medbrains/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@medbrains/api")>();
  return {
    ...actual,
    api: {
      ...actual.api,
      listCampCounters: () => listCampCounters(),
      listDepartments: async () => [{ id: "d1", name: "General Medicine" }],
    },
  };
});

vi.mock("@medbrains/stores", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@medbrains/stores")>()),
  useHasPermission: () => true,
  useFieldAccess: () => "edit",
}));

const { CountersTab } = await import("./counters-tab");

const silentClient = () =>
  new QueryClient({
    queryCache: new QueryCache({ onError: () => {} }),
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

const counter = (over: Record<string, unknown>) => ({
  id: "c1",
  tenant_id: "t",
  camp_id: CAMP,
  counter_type: "service",
  counter_name: "Consultation room 1",
  capacity_per_hour: 12,
  location_label: "School block A",
  status: "planned",
  notes: null,
  department_id: "d1",
  department_name: "General Medicine",
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
  ...over,
});

describe("camp counters", () => {
  it("says the list could not be read rather than showing no counters", async () => {
    // "This camp has no counters" is what sends someone to build a second set
    // of rooms that already exist.
    listCampCounters = async () => {
      throw new Error("503 upstream");
    };

    render(<CountersTab campId={CAMP} canUpdate />, { queryClient: silentClient() });

    await waitFor(() => expect(screen.getByText(/could not be loaded/i)).toBeInTheDocument());
  });

  it("flags a counter that will never reach the board", async () => {
    // A counter with no department mapping exists but cannot appear on the
    // board. Hiding it would leave someone recreating it; showing it silently
    // would leave them expecting it on the TV.
    listCampCounters = async () => [counter({ department_id: null, department_name: null })];

    render(<CountersTab campId={CAMP} canUpdate />, { queryClient: silentClient() });

    await waitFor(() => expect(screen.getByText(/not on the board/i)).toBeInTheDocument());
  });

  it("does not cry outage when the camp genuinely has none", async () => {
    listCampCounters = async () => [];

    render(<CountersTab campId={CAMP} canUpdate />, { queryClient: silentClient() });

    await waitFor(() => expect(screen.getByText(/one card per counter/i)).toBeInTheDocument());
    expect(screen.queryByText(/could not be loaded/i)).not.toBeInTheDocument();
  });
});
