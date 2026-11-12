/**
 * An outage on a clinical list says it did not load; it never reads as an
 * empty ward, an empty queue or zero free beds (#5474, authz law rule 6).
 */
import { ApiError } from "@medbrains/api";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/test-utils";
import { PatientGridTab } from "./care-view/PatientGridTab";
import { BedDashboardTab } from "./ipd/bed-dashboard";
import { OpdVitalsCounter } from "./opd/vitals-counter";

vi.mock("@medbrains/stores", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@medbrains/stores")>()),
  useHasPermission: () => true,
}));

const careView = vi.hoisted(() => ({
  wardOnDuty: vi.fn(),
  wardPatientGrid: vi.fn(),
  vitalsChecklist: vi.fn(),
}));
vi.mock("@/services/careView.service", () => ({ careViewService: careView }));

const ipd = vi.hoisted(() => ({
  bedDashboardSummary: vi.fn(),
  bedDashboardBeds: vi.fn(),
  listBedReservations: vi.fn(),
}));
vi.mock("@/services/ipd.service", () => ({ ipdService: ipd }));

const opd = vi.hoisted(() => ({ listQueue: vi.fn() }));
vi.mock("@/services/opd.service", () => ({ opdService: opd }));

/** What a stopped backend answers through the API client. */
const outage = () => new ApiError("Service unavailable", 503);

beforeEach(() => {
  for (const fn of [...Object.values(careView), ...Object.values(ipd), ...Object.values(opd)]) {
    fn.mockReset();
    fn.mockRejectedValue(outage());
  }
});

describe("a clinical list whose read failed", () => {
  it("ward grid says the patients did not load, not that the ward is empty", async () => {
    render(<PatientGridTab wardId="ward-1" />);
    expect(await screen.findByText("Ward patients didn't load")).toBeInTheDocument();
    expect(await screen.findByText("On-duty list didn't load")).toBeInTheDocument();
    expect(screen.queryByText("patientGrid.empty")).not.toBeInTheDocument();
  });

  it("bed board says the beds did not load instead of drawing zeros", async () => {
    render(<BedDashboardTab />);
    expect(await screen.findByText("Bed counts didn't load")).toBeInTheDocument();
    expect(await screen.findByText("Beds didn't load")).toBeInTheDocument();
    expect(screen.queryByText("bedDashboard.noBedsFound")).not.toBeInTheDocument();
  });

  it("vitals counter says the queue did not load, not that nobody is waiting", async () => {
    render(<OpdVitalsCounter />);
    expect(await screen.findByText("The queue didn't load")).toBeInTheDocument();
    expect(screen.queryByText("vitalsCounter.emptyTitle")).not.toBeInTheDocument();
    expect(screen.queryByText(/vitalsCounter.waitingCount/)).not.toBeInTheDocument();
  });

  it("an empty answer is still shown as empty", async () => {
    opd.listQueue.mockResolvedValue([]);
    render(<OpdVitalsCounter />);
    expect(await screen.findByText("vitalsCounter.emptyTitle")).toBeInTheDocument();
    expect(screen.queryByText("The queue didn't load")).not.toBeInTheDocument();
  });
});
