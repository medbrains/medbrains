import { QueryCache, QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/test-utils";

const service = vi.hoisted(() => ({
  getVisitFileStatus: vi.fn(),
  getVisitDigitalSummary: vi.fn(),
}));
vi.mock("@/services/mrd.service", () => ({ mrdService: service }));
const perms = vi.hoisted(() => ({ status: true }));
vi.mock("@medbrains/stores", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@medbrains/stores")>()),
  useHasPermission: () => perms.status,
}));

const { VisitFilePanel } = await import("./VisitFilePanel");

const summary = {
  allergies: [{ allergen_name: "Penicillin", reaction: "rash", severity: "life_threatening" }],
  diagnoses: [{ description: "Type 2 diabetes", icd_code: "E11", encounter_date: "2026-09-01" }],
  diagnoses_withheld: null,
  medicines: [
    {
      drug_name: "Metformin",
      dosage: "500 mg",
      frequency: "BD",
      duration: "30 days",
      prescribed_on: "2026-10-01",
    },
  ],
  abnormal_results: [
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
};

describe("VisitFilePanel", () => {
  beforeEach(() => {
    perms.status = true;
    vi.clearAllMocks();
  });

  it("says the file arrived and shows the digital record beside it", async () => {
    service.getVisitFileStatus.mockResolvedValue({
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
    });
    service.getVisitDigitalSummary.mockResolvedValue(summary);
    render(<VisitFilePanel encounterId="e1" />);
    expect(await screen.findByText("File: arrived")).toBeInTheDocument();
    expect(await screen.findByText(/Penicillin \(life threatening\)/)).toBeInTheDocument();
    expect(screen.getByText(/Type 2 diabetes · E11/)).toBeInTheDocument();
    expect(screen.getByText(/Metformin 500 mg, BD, 30 days/)).toBeInTheDocument();
    expect(screen.getByText(/HbA1c 9.1 % \(high\)/)).toBeInTheDocument();
  });

  it("says diagnoses are withheld rather than that there are none", async () => {
    service.getVisitFileStatus.mockResolvedValue({ has_physical_file: false, request: null });
    service.getVisitDigitalSummary.mockResolvedValue({
      ...summary,
      diagnoses: [],
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

  it("sends neither read for a role without the permission", () => {
    perms.status = false;
    render(<VisitFilePanel encounterId="e1" />);
    expect(service.getVisitFileStatus).not.toHaveBeenCalled();
    expect(service.getVisitDigitalSummary).not.toHaveBeenCalled();
    expect(screen.queryByTestId("visit-file-panel")).toBeNull();
  });
});
