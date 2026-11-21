import type { OpdNumberView } from "@medbrains/types";
import { describe, expect, it } from "vitest";
import { visitAsksForNumber, visitOpdFields } from "./VisitOpdNumberField";

const VIEW: OpdNumberView = {
  mode: "manual",
  scope: "patient",
  prefix: "",
  start: 1,
  allow_backdate: true,
  previous: "1042",
  next: "1043",
};

describe("the OPD number when a visit is started", () => {
  it("asks an existing patient without a number, never one who has it", () => {
    expect(visitAsksForNumber(VIEW, false)).toBe(true);
    expect(visitAsksForNumber(VIEW, true)).toBe(false);
    expect(visitAsksForNumber({ ...VIEW, mode: "off" }, false)).toBe(false);
    expect(visitAsksForNumber({ ...VIEW, scope: "visit" }, true)).toBe(true);
  });

  it("sends the number shown (typed or the next) with its date, nothing when not asked", () => {
    expect(visitOpdFields(VIEW, false, {})).toEqual({ opd_number: "1043", opd_date: undefined });
    expect(visitOpdFields(VIEW, false, { number: " 17 ", date: "2019-03-04" })).toEqual({
      opd_number: "17",
      opd_date: "2019-03-04",
    });
    expect(visitOpdFields(VIEW, true, { number: "17" })).toEqual({});
  });

  it("lets the server pick in auto mode and never dates a per-visit number", () => {
    expect(visitOpdFields({ ...VIEW, mode: "auto" }, false, { number: "9" }).opd_number).toBe(
      undefined,
    );
    expect(visitOpdFields({ ...VIEW, scope: "visit" }, true, { date: "2019-03-04" })).toEqual({
      opd_number: "1043",
      opd_date: undefined,
    });
  });
});
