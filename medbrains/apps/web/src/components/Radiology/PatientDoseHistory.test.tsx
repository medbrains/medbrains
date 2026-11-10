import type { PatientDoseRecord } from "@medbrains/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/test-utils";
import { PatientDoseHistory } from "./PatientDoseHistory";

const service = vi.hoisted(() => ({
  cumulativeDose: vi.fn(),
  listPatientDoseRecords: vi.fn(),
}));
vi.mock("@/services/radiology.service", () => ({ radiologyService: service }));

const held = vi.hoisted(() => new Set<string>(["radiology.orders.view"]));
vi.mock("@medbrains/stores", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@medbrains/stores")>()),
  useHasPermission: (code: string) => held.has(code),
}));

function record(over: Partial<PatientDoseRecord>): PatientDoseRecord {
  return {
    id: "d",
    tenant_id: "t",
    order_id: "o",
    patient_id: "p",
    modality_code: "CT",
    body_part: null,
    dose_value: null,
    dose_unit: "mGy",
    dlp: "1000.0000",
    ctdi_vol: null,
    dap: null,
    fluoroscopy_time_seconds: null,
    exposure_count: null,
    kvp: null,
    mas: null,
    source: "manual",
    dicom_study_id: null,
    recorded_by: null,
    recorded_at: "2026-10-26T10:00:00Z",
    created_at: "2026-10-26T10:00:00Z",
    accession_number: null,
    exam: "CT Brain",
    region: "head",
    estimated_msv: 2.1,
    not_estimated: null,
    ...over,
  };
}

beforeEach(() => {
  service.cumulativeDose.mockResolvedValue({
    ct_exam_count: 0,
    dap_exam_count: 0,
  });
});

describe("PatientDoseHistory", () => {
  it("shows each exam's estimate with its region, and says when one cannot be made", async () => {
    service.listPatientDoseRecords.mockResolvedValue([
      record({ id: "a" }),
      record({
        id: "b",
        exam: "CT Left knee",
        region: null,
        estimated_msv: null,
        not_estimated: "region_unknown",
      }),
    ]);
    render(<PatientDoseHistory patientId="p" />);
    expect(await screen.findByText("≈ 2.10 mSv (head)")).toBeInTheDocument();
    expect(screen.getByText("Not estimated — body region not recognised")).toBeInTheDocument();
  });

  it("does not fetch for someone who cannot read imaging orders", () => {
    held.clear();
    render(<PatientDoseHistory patientId="p" />);
    expect(service.listPatientDoseRecords).not.toHaveBeenCalled();
  });
});
