import { QueryCache, QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent } from "@/test/test-utils";

const service = vi.hoisted(() => ({
  getVisitFileStatus: vi.fn(),
  getVisitDigitalSummary: vi.fn(),
  requestVisitFile: vi.fn(),
}));
vi.mock("@/services/mrd.service", () => ({ mrdService: service }));
const perms = vi.hoisted(() => ({ chip: true, summary: true, create: true }));
vi.mock("@medbrains/stores", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@medbrains/stores")>()),
  useHasPermission: (code: string) =>
    code === "mrd.file_request.create" ? perms.create : perms.chip,
  useHasAllPermissions: () => perms.summary,
}));

const { VisitFilePanel } = await import("./VisitFilePanel");

const summary = {
  allergies: {
    items: [{ allergen_name: "Penicillin", reaction: "rash", severity: "life_threatening" }],
    more: 0,
  },
  diagnoses: {
    items: [
      {
        description: "Type 2 diabetes",
        icd_code: "E11",
        encounter_date: "2026-09-01",
        withheld: false,
      },
      {
        description: "Restricted entry",
        icd_code: null,
        encounter_date: "2026-08-01",
        withheld: true,
      },
    ],
    more: 3,
  },
  diagnoses_withheld: null,
  medicines: {
    items: [
      {
        drug_name: "Metformin",
        dosage: "500 mg",
        frequency: "BD",
        duration: "30 days",
        prescribed_on: "2026-10-01",
      },
    ],
    more: 0,
  },
  abnormal_results: {
    items: [
      {
        test_name: "HbA1c",
        parameter_name: "HbA1c",
        value: "9.1",
        unit: "%",
        flag: "high",
        is_critical: false,
        resulted_on: "2026-10-01",
      },
    ],
    more: 0,
  },
};

const delivered = {
  has_physical_file: true,
  request: {
    id: "r",
    status: "delivered",
    record_number: "MRD-1",
    requested_at: "",
    due_at: "",
    picked_at: null,
    delivered_at: "",
  },
};

describe("VisitFilePanel", () => {
  beforeEach(() => {
    perms.chip = true;
    perms.summary = true;
    perms.create = true;
    vi.clearAllMocks();
  });

  it("says the file arrived and shows the digital record beside it", async () => {
    service.getVisitFileStatus.mockResolvedValue(delivered);
    service.getVisitDigitalSummary.mockResolvedValue(summary);
    render(<VisitFilePanel encounterId="e1" />);
    expect(await screen.findByText("File: arrived")).toBeInTheDocument();
    expect(await screen.findByText(/Penicillin \(life threatening\)/)).toBeInTheDocument();
    expect(screen.getByText(/Type 2 diabetes · E11/)).toBeInTheDocument();
    expect(screen.getByText(/Metformin 500 mg, BD, 30 days/)).toBeInTheDocument();
    expect(screen.getByText(/HbA1c 9.1 % \(high\)/)).toBeInTheDocument();
  });

  it("shows a withheld mental-health diagnosis as a restricted entry, and what was cut off", async () => {
    service.getVisitFileStatus.mockResolvedValue(delivered);
    service.getVisitDigitalSummary.mockResolvedValue(summary);
    render(<VisitFilePanel encounterId="e1" />);
    expect(await screen.findByText(/Restricted entry/)).toBeInTheDocument();
    expect(screen.getByText("3 more not shown")).toBeInTheDocument();
  });

  it("says diagnoses are withheld rather than that there are none", async () => {
    service.getVisitFileStatus.mockResolvedValue({ has_physical_file: false, request: null });
    service.getVisitDigitalSummary.mockResolvedValue({
      ...summary,
      diagnoses: { items: [], more: 0 },
      diagnoses_withheld: 3,
    });
    render(<VisitFilePanel encounterId="e1" />);
    expect(await screen.findByText("3 withheld for your role")).toBeInTheDocument();
    expect(screen.queryByTestId("visit-file-chip")).toBeNull();
  });

  it("reports a status outage as a fault and keeps the summary", async () => {
    service.getVisitFileStatus.mockRejectedValue(new Error("down"));
    service.getVisitDigitalSummary.mockResolvedValue(summary);
    render(<VisitFilePanel encounterId="e1" />, {
      queryClient: new QueryClient({
        queryCache: new QueryCache({ onError: () => {} }),
        defaultOptions: { queries: { retry: false, gcTime: 0 } },
      }),
    });
    expect(await screen.findByText("File status unavailable")).toBeInTheDocument();
    expect(await screen.findByText(/Penicillin/)).toBeInTheDocument();
  });

  it("gives a chip-only role (the records room) the chip and never asks for the summary", async () => {
    perms.summary = false;
    service.getVisitFileStatus.mockResolvedValue(delivered);
    render(<VisitFilePanel encounterId="e1" />);
    expect(await screen.findByText("File: arrived")).toBeInTheDocument();
    expect(service.getVisitDigitalSummary).not.toHaveBeenCalled();
  });

  it("lets the doctor ask for a file that was never requested, and shows the new state", async () => {
    perms.summary = false;
    service.getVisitFileStatus.mockResolvedValue({ has_physical_file: true, request: null });
    service.requestVisitFile.mockResolvedValue({
      has_physical_file: true,
      request: { ...delivered.request, status: "requested" },
    });
    render(<VisitFilePanel encounterId="e1" />);
    expect(await screen.findByText("File: not requested")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Request file" }));
    expect(service.requestVisitFile).toHaveBeenCalledWith("e1");
    expect(await screen.findByText("File: requested")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Request file" })).toBeNull();
  });

  it("offers no request button without the permission, or once the file is asked for", async () => {
    perms.summary = false;
    perms.create = false;
    service.getVisitFileStatus.mockResolvedValue({ has_physical_file: true, request: null });
    const { unmount } = render(<VisitFilePanel encounterId="e1" />);
    expect(await screen.findByText("File: not requested")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Request file" })).toBeNull();
    unmount();
    perms.create = true;
    service.getVisitFileStatus.mockResolvedValue(delivered);
    render(<VisitFilePanel encounterId="e2" />);
    expect(await screen.findByText("File: arrived")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Request file" })).toBeNull();
  });

  it("sends neither read for a role with neither permission", () => {
    perms.chip = false;
    perms.summary = false;
    render(<VisitFilePanel encounterId="e1" />);
    expect(service.getVisitFileStatus).not.toHaveBeenCalled();
    expect(service.getVisitDigitalSummary).not.toHaveBeenCalled();
    expect(screen.queryByTestId("visit-file-panel")).toBeNull();
  });
});
