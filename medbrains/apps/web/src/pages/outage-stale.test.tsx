/**
 * A failed read that follows a good one keeps the good copy on screen under a
 * "may be out of date" banner; a read that never succeeded replaces the list.
 * Plus the two screens whose only list is a table or a single entry (#5474).
 */
import { ApiError } from "@medbrains/api";
import type { QueueEntry } from "@medbrains/types";
import { QueryClient } from "@tanstack/react-query";
import { Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent, waitFor, within } from "@/test/test-utils";
import { PatientGridTab } from "./care-view/PatientGridTab";
import { BedDashboardTab } from "./ipd/bed-dashboard";
import { LabPage } from "./lab";
import { OpdVitalsPage } from "./opd";
import { OpdVitalsCounter } from "./opd/vitals-counter";

vi.mock("@medbrains/stores", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@medbrains/stores")>()),
  useHasPermission: () => true,
}));
vi.mock("@/hooks/useRequirePermission", () => ({ useRequirePermission: () => {} }));

/** A service whose every method fails the way a stopped backend does. */
const failing = vi.hoisted(
  () => () =>
    new Proxy({} as Record<string, ReturnType<typeof vi.fn>>, {
      get: (fns, name: string) => {
        fns[name] ??= vi.fn(() => Promise.reject(new Error("Service unavailable")));
        return fns[name];
      },
    }),
);
const services = vi.hoisted(() => ({
  careView: failing(),
  ipd: failing(),
  opd: failing(),
  lab: failing(),
  lookups: failing(),
}));
vi.mock("@/services/careView.service", () => ({ careViewService: services.careView }));
vi.mock("@/services/ipd.service", () => ({ ipdService: services.ipd }));
vi.mock("@/services/opd.service", () => ({ opdService: services.opd }));
vi.mock("@/services/lab.service", () => ({ labService: services.lab }));
vi.mock("@/services/lookups.service", () => ({ lookupsService: services.lookups }));

const outage = () => new ApiError("Service unavailable", 503);

/** One patient waiting at the vitals counter. */
const waitingEntry = {
  id: "q-1",
  encounter_id: "e-1",
  patient_id: "p-1",
  token_number: 7,
  status: "waiting",
  has_vitals: false,
  patient_name: "Asha Rao",
  uhid: "UH-1",
} as unknown as QueueEntry;

/** A client that keeps data across refetches, as the app's does. */
function client() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } });
}

beforeEach(() => {
  for (const service of Object.values(services)) {
    for (const fn of Object.values(service)) {
      fn.mockReset();
      fn.mockImplementation(() => Promise.reject(outage()));
    }
  }
});

describe("a failed refetch after a good read", () => {
  it("vitals counter keeps the waiting patient under an out-of-date banner", async () => {
    services.opd.listQueue.mockResolvedValueOnce([waitingEntry]);
    const queryClient = client();
    render(<OpdVitalsCounter />, { queryClient });
    expect(await screen.findByText("Asha Rao")).toBeInTheDocument();
    await queryClient.refetchQueries();
    expect(await screen.findByText("The queue may be out of date")).toBeInTheDocument();
    expect(screen.getByText("Asha Rao")).toBeInTheDocument();
  });

  it("bed board keeps the beds it had under an out-of-date banner", async () => {
    services.ipd.bedDashboardBeds.mockResolvedValueOnce([
      {
        bed_state_id: "b-1",
        bed_location_id: "l-1",
        bed_name: "Bed 12",
        bed_status: "vacant_clean",
      },
    ]);
    const queryClient = client();
    render(<BedDashboardTab />, { queryClient });
    expect(await screen.findByText("Bed 12")).toBeInTheDocument();
    await queryClient.refetchQueries();
    expect(await screen.findByText("Beds may be out of date")).toBeInTheDocument();
    expect(screen.getByText("Bed 12")).toBeInTheDocument();
  });
});

describe("retry after an outage", () => {
  it("ward grid asks again when Retry is pressed", async () => {
    render(<PatientGridTab wardId="ward-1" />);
    await screen.findByText("Ward patients didn't load");
    const alerts = screen.getAllByRole("alert");
    const grid = alerts.find((a) => within(a).queryByText("Ward patients didn't load"));
    if (!grid) throw new Error("no ward-grid alert");
    const before = services.careView.wardPatientGrid.mock.calls.length;
    await userEvent.click(within(grid).getByRole("button", { name: "Retry" }));
    await waitFor(() =>
      expect(services.careView.wardPatientGrid.mock.calls.length).toBeGreaterThan(before),
    );
  });
});

describe("lists that are a table or one entry", () => {
  it("lab worklist says it did not load, not that there are no orders", async () => {
    render(<LabPage />);
    expect((await screen.findAllByText("This didn't load")).length).toBeGreaterThan(0);
    expect(screen.queryByText("No data found")).not.toBeInTheDocument();
  });

  it("vitals route says the queue did not load, not that the entry is gone", async () => {
    render(
      <Routes>
        <Route path="/opd/vitals/:queueEntryId" element={<OpdVitalsPage />} />
      </Routes>,
      { initialEntries: ["/opd/vitals/q-1"] },
    );
    expect(await screen.findByText("This didn't load")).toBeInTheDocument();
    expect(screen.queryByText("vitals.queueEntryNotFound")).not.toBeInTheDocument();
  });
});
