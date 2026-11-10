import type { Dosimetry, RadiationEquipment } from "@medbrains/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent } from "@/test/test-utils";
import { RadiationSafetyTab } from "./radiation-safety-tab";

const service = vi.hoisted(() => ({
  listRadiationEquipment: vi.fn(),
  saveRadiationEquipment: vi.fn(),
  listBmeEquipment: vi.fn(),
  listRadiologyModalities: vi.fn(),
  listRadiologyDosimetry: vi.fn(),
  createRadiologyDosimetry: vi.fn(),
  removeRadiologyDosimetry: vi.fn(),
  listReferenceLevels: vi.fn(),
  saveReferenceLevel: vi.fn(),
  drlAudit: vi.fn(),
}));
vi.mock("@/services/radiology.service", () => ({ radiologyService: service }));

const CT: RadiationEquipment = {
  id: "r1",
  bme_equipment_id: "b1",
  name: "CT scanner 1",
  make: "Siemens",
  model: "Somatom",
  serial_number: "SN-9",
  modality_id: "m1",
  modality_code: "CT",
  aerb_licence_number: null,
  elora_id: null,
  licence_valid_until: "2026-10-01",
  rso_user_id: null,
  rso_name: null,
  qa_agency: null,
  last_qa_date: null,
  qa_due_date: "2026-11-15",
  notes: null,
  alerts: [
    { level: "danger", message: "No AERB licence recorded" },
    { level: "danger", message: "Licence expired on 2026-10-01" },
    { level: "warning", message: "QA due on 2026-11-15" },
  ],
};

const DOSES: Dosimetry = {
  year: 2026,
  staff: [
    {
      staff_id: "u1",
      staff_name: "Anil Radiographer",
      year_msv: 22.5,
      five_year_msv: 61,
      readings: 3,
      last_period_end: "2026-09-30",
      alerts: [
        {
          level: "warning",
          message: "22.50 mSv this year — over the 20 mSv annual average; investigate",
        },
      ],
    },
  ],
  readings: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  service.listRadiationEquipment.mockResolvedValue([CT]);
  service.listBmeEquipment.mockResolvedValue([]);
  service.listRadiologyModalities.mockResolvedValue([]);
  service.listRadiologyDosimetry.mockResolvedValue(DOSES);
  service.listReferenceLevels.mockResolvedValue([
    {
      id: "l1",
      region: "head",
      metric: "dlp",
      value: "1041.00",
      source: "Regional survey, South India 2016 (PMC6038221) — not a national DRL",
    },
  ]);
  service.drlAudit.mockResolvedValue({
    from: "2026-08-01",
    to: "2026-10-30",
    min_exams: 10,
    rows: [
      {
        level_id: "l1",
        region: "head",
        metric: "dlp",
        drl: 1041,
        source: "x",
        exams: 12,
        median: 1130,
        p75: 1210,
        verdict: "above",
      },
    ],
  });
});

describe("RadiationSafetyTab", () => {
  it("names what is expired or missing on each unit", async () => {
    render(<RadiationSafetyTab />);
    expect(await screen.findByText("No AERB licence recorded")).toBeInTheDocument();
    expect(screen.getByText("Licence expired on 2026-10-01")).toBeInTheDocument();
    expect(screen.getByText("QA due on 2026-11-15")).toBeInTheDocument();
  });

  it("asks for a unit from the biomedical register before saving", async () => {
    render(<RadiationSafetyTab />);
    await userEvent.click(await screen.findByRole("button", { name: "Add a unit" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(
      await screen.findByText("Pick the unit from the biomedical register"),
    ).toBeInTheDocument();
    expect(service.saveRadiationEquipment).not.toHaveBeenCalled();
  });

  it("shows each person's dose against the limits", async () => {
    render(<RadiationSafetyTab />);
    await userEvent.click(screen.getByText("Staff dosimetry (TLD)"));
    expect(await screen.findByText("Anil Radiographer")).toBeInTheDocument();
    expect(screen.getByText(/over the 20 mSv annual average/)).toBeInTheDocument();
  });

  it("labels regional levels and flags a median above the level", async () => {
    render(<RadiationSafetyTab />);
    await userEvent.click(screen.getByText("Reference levels (DRL)"));
    expect(await screen.findByText(/not a national DRL/)).toBeInTheDocument();
    expect(
      await screen.findByText("Median above the level — review the protocol"),
    ).toBeInTheDocument();
    expect(screen.getByText("1130.0")).toBeInTheDocument();
  });
});
