import type { MrdFileRequest } from "@medbrains/types";
import { QueryCache, QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent } from "@/test/test-utils";

const service = vi.hoisted(() => ({
  listMrdFileRequests: vi.fn(),
  scanMrdFileRequest: vi.fn(),
  markMrdFileNotFound: vi.fn(),
  buildMrdPullList: vi.fn(),
}));
vi.mock("@/services/mrd.service", () => ({ mrdService: service }));
const perms = vi.hoisted(() => ({ fulfil: true }));
vi.mock("@medbrains/stores", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@medbrains/stores")>()),
  useHasPermission: () => perms.fulfil,
}));

const { FileRequestsTab } = await import("./FileRequestsTab");

const request: MrdFileRequest = {
  id: "fr1",
  patient_id: "p1",
  patient_name: "Lakshmi Devi",
  uhid: "UH-42",
  medical_record_id: "m1",
  record_number: "MRD-000042",
  encounter_id: "e1",
  appointment_id: null,
  source: "visit",
  department_id: "d1",
  department_name: "Cardiology OPD",
  doctor_id: "u1",
  doctor_name: "Dr Rao",
  location_label: "Rack 3 / Shelf B / Bin 7",
  visit_date: "2026-11-08",
  slot_start: null,
  status: "requested",
  requested_at: new Date().toISOString(),
  due_at: new Date(Date.now() + 8 * 60_000).toISOString(),
  picked_at: null,
  picked_by_name: null,
  delivered_at: null,
  delivered_by_name: null,
  escalated_at: null,
  holder_department: "Orthopaedics OPD",
  holder_user: null,
  holder_since: new Date().toISOString(),
};

const silentClient = () =>
  new QueryClient({
    queryCache: new QueryCache({ onError: () => {} }),
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

describe("FileRequestsTab", () => {
  beforeEach(() => {
    perms.fulfil = true;
    vi.clearAllMocks();
  });

  it("shows the errand: shelf, destination, timer and where the file is now", async () => {
    service.listMrdFileRequests.mockResolvedValue([request]);
    render(<FileRequestsTab />);
    expect(await screen.findByText("Lakshmi Devi")).toBeInTheDocument();
    expect(screen.getByText("Rack 3 / Shelf B / Bin 7")).toBeInTheDocument();
    expect(screen.getByText("To Dr Rao, Cardiology OPD")).toBeInTheDocument();
    expect(screen.getByText(/min left/)).toBeInTheDocument();
    expect(screen.getByText(/Out with Orthopaedics OPD/)).toBeInTheDocument();
  });

  it("draws a failed read as a fault, never as an empty queue", async () => {
    service.listMrdFileRequests.mockRejectedValue(new Error("network down"));
    render(<FileRequestsTab />, { queryClient: silentClient() });
    expect(await screen.findByText("File requests did not load")).toBeInTheDocument();
    expect(screen.queryByText(/No files waiting/)).toBeNull();
  });

  it("shows the server's refusal when the wrong file is scanned", async () => {
    service.listMrdFileRequests.mockResolvedValue([request]);
    service.scanMrdFileRequest.mockRejectedValue(
      new Error("This barcode is not the requested file. Scan file MRD-000042."),
    );
    render(<FileRequestsTab />);
    await userEvent.click(await screen.findByRole("button", { name: "Scan at shelf" }));
    await userEvent.type(await screen.findByLabelText(/File barcode/), "MRD-000099{enter}");
    expect(await screen.findByText(/not the requested file/)).toBeInTheDocument();
    expect(service.scanMrdFileRequest).toHaveBeenCalledWith("fr1", {
      barcode: "MRD-000099",
      step: "picked",
    });
  });

  it("offers no scan or not-found to a role that cannot fulfil", async () => {
    perms.fulfil = false;
    service.listMrdFileRequests.mockResolvedValue([request]);
    render(<FileRequestsTab />);
    await screen.findByText("Lakshmi Devi");
    expect(screen.queryByRole("button", { name: "Scan at shelf" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Not found" })).toBeNull();
  });
});
