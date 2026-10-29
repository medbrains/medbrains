import type { IhipLineList } from "@medbrains/types";
import { describe, expect, it, vi } from "vitest";
import { render, screen, userEvent } from "@/test/test-utils";
import { IhipTab, reportingWeek } from "./ihip-tab";

const service = vi.hoisted(() => ({
  getIhipLineList: vi.fn(),
  submitIhipLineList: vi.fn(),
  getPublicHealthFacility: vi.fn(),
}));
vi.mock("@/services/ckb.service", () => ({ ckbService: service }));

const list: IhipLineList = {
  form: "P",
  facility: {
    name: "H",
    registration_no: null,
    phone: null,
    address: null,
    nikshay_he_code: null,
    ihip_unit_id: "TN-DSU-17",
  },
  period_from: "2026-10-19",
  period_to: "2026-10-25",
  columns: ["Sr No", "Patient name"],
  rows: [
    ["1", "A"],
    ["2", "B"],
  ],
  report_ids: ["r1", "r2"],
  summary: [{ disease_name: "Dengue fever", icd10_code: "A90", cases: 2 }],
};

describe("reportingWeek", () => {
  it("starts on the Monday of the IDSP week", () => {
    // Sunday 25 Oct 2026 belongs to the week of Monday 19 Oct.
    expect(reportingWeek(new Date(2026, 9, 25))).toEqual({ from: "2026-10-19", to: "2026-10-25" });
    expect(reportingWeek(new Date(2026, 9, 19)).from).toBe("2026-10-19");
  });
});

describe("IhipTab", () => {
  it("makes the list only when asked, then records the acknowledgement for its cases", async () => {
    service.getPublicHealthFacility.mockResolvedValue(list.facility);
    service.getIhipLineList.mockResolvedValue(list);
    service.submitIhipLineList.mockResolvedValue({ submitted: 2 });
    render(<IhipTab canList canManage canExport />);
    expect(service.getIhipLineList).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Make line list" }));
    expect(await screen.findByText("Dengue fever")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Record IHIP acknowledgement" }));
    await userEvent.click(await screen.findByRole("button", { name: "Mark submitted" }));
    expect(await screen.findByText("Give the acknowledgement IHIP showed")).toBeInTheDocument();
    expect(service.submitIhipLineList).not.toHaveBeenCalled();
    await userEvent.type(
      screen.getByRole("textbox", { name: /IHIP acknowledgement/ }),
      "IHIP/TN/1",
    );
    await userEvent.click(screen.getByRole("button", { name: "Mark submitted" }));
    expect(service.submitIhipLineList).toHaveBeenCalledWith({
      form: "P",
      report_ids: ["r1", "r2"],
      acknowledgement: "IHIP/TN/1",
    });
  });

  it("offers no list without the export permission", () => {
    render(<IhipTab canList={false} canManage={false} canExport={false} />);
    expect(screen.queryByRole("button", { name: "Make line list" })).toBeNull();
    expect(service.getPublicHealthFacility).not.toHaveBeenCalledTimes(2);
  });
});
