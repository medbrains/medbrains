import { describe, expect, it } from "vitest";
import { MASTER_DATA_GAPS } from "./MasterDataStatusSettings";
import { installedGaps } from "./master-data-gaps";

const gaps = (disabled: string[]) => installedGaps(MASTER_DATA_GAPS, new Set(disabled));
const scheduleRows = (disabled: string[]) =>
  gaps(disabled).filter((item) => item.actionHref === "/admin/doctor-schedules");

describe("installedGaps", () => {
  it("lists the doctor-schedule setup rows while the hospital has the EMR", () => {
    expect(scheduleRows([])).toHaveLength(2);
  });

  it("hides the doctor-schedule rows while the EMR is off, since their screen will not open", () => {
    expect(scheduleRows(["opd"])).toHaveLength(0);
    expect(gaps(["opd"]).length).toBe(gaps([]).length - 2);
  });
});
