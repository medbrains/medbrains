import type { NotifiableReport } from "@medbrains/types";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/test-utils";
import { ReportsTab } from "./reports-tab";

const service = vi.hoisted(() => ({ listNotifiableReports: vi.fn() }));
vi.mock("@/services/ckb.service", () => ({ ckbService: service }));

const base: NotifiableReport = {
  id: "r1",
  icd10_code: "A90",
  disease_name: "Dengue fever",
  reporting_body: "IDSP",
  detected_at: "2026-10-20T08:00:00Z",
  status: "pending",
  case_class: "presumptive",
  source: "opd_diagnosis",
  due_at: "2026-10-21T08:00:00Z",
};

describe("ReportsTab", () => {
  it("shows the IDSP form each row needs, where it came from, and what is overdue", async () => {
    service.listNotifiableReports.mockResolvedValue([
      base,
      {
        ...base,
        id: "r2",
        case_class: "confirmed",
        source: "lab_result",
        presumptive_ref: "IHIP-1234",
        due_at: "2999-01-01T00:00:00Z",
      },
    ]);
    render(<ReportsTab canManage canList />);
    expect(await screen.findByText("Presumptive")).toBeInTheDocument();
    expect(screen.getByText("Lab-confirmed")).toBeInTheDocument();
    expect(screen.getByText("OPD diagnosis")).toBeInTheDocument();
    expect(screen.getByText("Lab result")).toBeInTheDocument();
    expect(screen.getByText("P-form: IHIP-1234")).toBeInTheDocument();
    expect(screen.getAllByText("Overdue")).toHaveLength(1);
  });

  it("does not ask for the worklist without the permission to read it", () => {
    service.listNotifiableReports.mockClear();
    render(<ReportsTab canManage={false} canList={false} />);
    expect(service.listNotifiableReports).not.toHaveBeenCalled();
  });
});
