import type { OpdNumberView } from "@medbrains/types";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { opdLabel } from "@/utils/patient-identity";
import { OPD_NUMBER_QUERY_KEY, opdNumberFields } from "./OpdNumberRow";

function clientWith(view: Partial<OpdNumberView> | null): QueryClient {
  const client = new QueryClient();
  if (view) {
    client.setQueryData(OPD_NUMBER_QUERY_KEY, {
      mode: "manual",
      scope: "patient",
      prefix: "",
      start: 1,
      allow_backdate: true,
      previous: "1042",
      next: "1043",
      ...view,
    });
  }
  return client;
}

describe("what registration sends for the OPD number", () => {
  it("sends the pre-filled next number when the desk leaves it as shown", () => {
    expect(opdNumberFields(clientWith({}), {})).toEqual({ opd_number: "1043" });
  });

  it("sends what the desk typed, and the register date per patient", () => {
    const sent = opdNumberFields(clientWith({}), { opd_number: " 17 ", opd_date: "2019-03-04" });
    expect(sent).toEqual({ opd_number: "17", opd_date: "2019-03-04" });
  });

  it("sends nothing typed in auto mode, and nothing at all when off or not loaded", () => {
    expect(opdNumberFields(clientWith({ mode: "auto" }), { opd_number: "9" })).toEqual({
      opd_number: undefined,
    });
    expect(opdNumberFields(clientWith({ mode: "off" }), { opd_number: "9" })).toEqual({});
    expect(opdNumberFields(clientWith(null), { opd_number: "9" })).toEqual({});
  });

  it("sends the register number as the UHID (typed, else Next) and no OPD number in one-number mode", () => {
    const one = clientWith({ mode: "uhid" });
    expect(opdNumberFields(one, {})).toEqual({ uhid: "1043", opd_date: undefined });
    expect(opdNumberFields(one, { uhid: " 17 ", opd_number: "9", opd_date: "2019-03-04" })).toEqual(
      { uhid: "17", opd_date: "2019-03-04" },
    );
  });

  it("never sends a date for a per-visit number", () => {
    const sent = opdNumberFields(clientWith({ scope: "visit" }), { opd_date: "2019-03-04" });
    expect(sent).toEqual({ opd_number: "1043", opd_date: undefined });
  });
});

describe("the OPD number in the patient header", () => {
  it("shows the number and its register date, or nothing", () => {
    expect(opdLabel({ opd_number: "1043", opd_date: "2019-03-04" })).toBe(
      " · OPD 1043 (04 Mar 2019)",
    );
    expect(opdLabel({ opd_number: "OP-7", opd_date: null })).toBe(" · OPD OP-7");
    expect(opdLabel({ opd_number: null })).toBe("");
    expect(opdLabel(undefined)).toBe("");
  });
});
