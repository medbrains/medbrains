import { describe, expect, it } from "vitest";
import { installedGaps } from "./MasterDataStatusSettings";

const scheduleRows = (disabled: string[]) =>
  installedGaps(new Set(disabled)).filter((item) => item.actionHref === "/admin/doctor-schedules");

describe("installedGaps", () => {
  it("lists the doctor-schedule setup rows while the hospital has the EMR", () => {
    expect(scheduleRows([])).toHaveLength(2);
  });

  it("hides the doctor-schedule rows while the EMR is off, since their screen will not open", () => {
    expect(scheduleRows(["opd"])).toHaveLength(0);
    expect(installedGaps(new Set(["opd"])).length).toBe(installedGaps(new Set()).length - 2);
  });
});
