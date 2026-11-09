import type { MrdFileRequest } from "@medbrains/types";
import { describe, expect, it } from "vitest";
import {
  dueLabel,
  groupByDoctor,
  holderText,
  isFileRequestable,
  tomorrowIso,
  visitChip,
} from "./fileRequestTime";

const NOW = Date.parse("2026-11-08T10:00:00Z");

describe("dueLabel", () => {
  it("counts down, then says how late", () => {
    expect(dueLabel("2026-11-08T10:07:00Z", NOW)).toEqual({ text: "7 min left", isLate: false });
    expect(dueLabel("2026-11-08T10:00:10Z", NOW)).toEqual({ text: "Due now", isLate: false });
    expect(dueLabel("2026-11-08T09:48:00Z", NOW)).toEqual({ text: "12 min late", isLate: true });
  });
});

describe("visitChip", () => {
  const request = {
    id: "r1",
    record_number: "MRD-1",
    requested_at: "",
    due_at: "",
    picked_at: null,
    delivered_at: null,
  };

  it("names where the file is", () => {
    expect(
      visitChip({ has_physical_file: true, request: { ...request, status: "requested" } })?.label,
    ).toBe("File: requested");
    expect(
      visitChip({ has_physical_file: true, request: { ...request, status: "picked" } })?.label,
    ).toBe("File: on the way");
    expect(
      visitChip({ has_physical_file: true, request: { ...request, status: "delivered" } }),
    ).toEqual({
      label: "File: arrived",
      tone: "success",
    });
  });

  it("says a paper file was not requested rather than that there is none", () => {
    expect(visitChip({ has_physical_file: true, request: null })?.label).toBe(
      "File: not requested",
    );
    expect(
      visitChip({ has_physical_file: true, request: { ...request, status: "cancelled" } })?.label,
    ).toBe("File: not requested");
  });

  it("shows no chip for a patient with no paper file", () => {
    expect(visitChip({ has_physical_file: false, request: null })).toBeNull();
  });

  it("offers a request by hand only for a paper file with no live request", () => {
    expect(isFileRequestable({ has_physical_file: true, request: null })).toBe(true);
    expect(
      isFileRequestable({ has_physical_file: true, request: { ...request, status: "cancelled" } }),
    ).toBe(true);
    expect(
      isFileRequestable({ has_physical_file: true, request: { ...request, status: "picked" } }),
    ).toBe(false);
    expect(isFileRequestable({ has_physical_file: false, request: null })).toBe(false);
  });
});

describe("holderText and groupByDoctor", () => {
  const row = (over: Partial<MrdFileRequest>) =>
    ({
      id: Math.random().toString(),
      doctor_name: null,
      holder_user: null,
      holder_department: null,
      ...over,
    }) as MrdFileRequest;

  it("says who has a file that is out", () => {
    expect(holderText(row({ holder_department: "Cardiology OPD" }))).toBe(
      "Out with Cardiology OPD",
    );
    expect(holderText(row({}))).toBeNull();
  });

  it("keeps the server's order inside each doctor's group", () => {
    const groups = groupByDoctor([
      row({ id: "a", doctor_name: "Dr Rao" }),
      row({ id: "b", doctor_name: "Dr Iyer" }),
      row({ id: "c", doctor_name: "Dr Rao" }),
    ]);
    expect(groups.map(([d, rows]) => [d, rows.map((r) => r.id)])).toEqual([
      ["Dr Rao", ["a", "c"]],
      ["Dr Iyer", ["b"]],
    ]);
  });

  it("gives tomorrow's local date", () => {
    expect(tomorrowIso(new Date(2026, 11, 31, 23, 0))).toBe("2027-01-01");
  });
});
