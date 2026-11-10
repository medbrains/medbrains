import type { TbCase } from "@medbrains/types";
import { describe, expect, it, vi } from "vitest";
import { render, screen, userEvent } from "@/test/test-utils";
import { NikshayTab, tbGaps } from "./nikshay-tab";

const service = vi.hoisted(() => ({
  listTbCases: vi.fn(),
  getNikshaySheet: vi.fn(),
  getPublicHealthFacility: vi.fn(),
  updateNotifiableReport: vi.fn(),
}));
vi.mock("@/services/ckb.service", () => ({ ckbService: service }));

const tb: TbCase = {
  report_id: "r1",
  patient_id: "p1",
  uhid: "UH-1",
  patient_name: "Ravi Kumar",
  icd10_code: "A15",
  disease_name: "Tuberculosis (pulmonary)",
  case_class: "confirmed",
  status: "pending",
  nikshay_id: null,
  detected_at: "2026-10-20T08:00:00Z",
  due_at: "2026-10-21T08:00:00Z",
  site: "P",
  ep_site: null,
  patient_type: "new",
  basis: "pcr",
  diagnosed_on: "2026-10-20",
  treatment_started_on: null,
  weight_kg: null,
  regimen: null,
  notifying_doctor_id: null,
  notifying_doctor_name: null,
};

describe("NikshayTab", () => {
  it("names the law, what each case still needs, and what is overdue", async () => {
    service.listTbCases.mockResolvedValue([tb]);
    service.getPublicHealthFacility.mockResolvedValue({ name: "H", nikshay_he_code: "HE-77" });
    render(<NikshayTab canList canManage canExport />);
    expect(screen.getByText("TB notification is mandatory")).toBeInTheDocument();
    expect(await screen.findByText("Needs treatment start, weight")).toBeInTheDocument();
    expect(screen.getByText("Overdue")).toBeInTheDocument();
    expect(await screen.findByText("HE-77")).toBeInTheDocument();
  });

  it("makes the sheet only when asked, because each one is a recorded disclosure", async () => {
    service.listTbCases.mockResolvedValue([tb]);
    service.getNikshaySheet.mockClear();
    service.getNikshaySheet.mockResolvedValue({
      facility: { name: "H" },
      columns: [],
      rows: [],
      missing: [],
    });
    render(<NikshayTab canList canManage canExport />);
    await screen.findByText("Ravi Kumar");
    expect(service.getNikshaySheet).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /download sheet/i }));
    expect(service.getNikshaySheet).toHaveBeenCalledTimes(1);
  });

  it("asks nothing and offers no export without the permissions", () => {
    service.listTbCases.mockClear();
    service.getPublicHealthFacility.mockClear();
    render(<NikshayTab canList={false} canManage={false} canExport={false} />);
    expect(service.listTbCases).not.toHaveBeenCalled();
    expect(service.getPublicHealthFacility).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /download sheet/i })).toBeNull();
  });

  it("will not record a TB case as notified without its Ni-kshay ID", async () => {
    service.listTbCases.mockResolvedValue([tb]);
    service.updateNotifiableReport.mockClear();
    render(<NikshayTab canList canManage canExport={false} />);
    await userEvent.click(await screen.findByRole("button", { name: "Record Ni-kshay ID" }));
    await userEvent.click(await screen.findByRole("button", { name: "Mark submitted" }));
    expect(await screen.findByText("Give the Ni-kshay ID")).toBeInTheDocument();
    expect(service.updateNotifiableReport).not.toHaveBeenCalled();
  });
});

describe("tbGaps", () => {
  it("is empty once the form is complete", () => {
    expect(tbGaps({ ...tb, treatment_started_on: "2026-10-21", weight_kg: "52.0" })).toEqual([]);
  });
});
