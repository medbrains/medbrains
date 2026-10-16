import { describe, expect, it } from "vitest";
import { rowsFromSheet, SHEETS } from "./columns";

const beds = SHEETS.find((s) => s.key === "beds");

describe("reading a workbook sheet", () => {
  it("finds columns by header, in any order and spelling, numbering rows as Excel does", () => {
    if (!beds) throw new Error("no beds sheet");
    const rows = rowsFromSheet(beds, [
      ["Room", "WARD CODE", "Bed Code", "Notes"],
      ["R1", "W1", "B01", "near window"],
      [null, null, null, null],
      ["", "W1", " B02 ", null],
    ]);
    expect(rows).toEqual([
      { row: 2, code: "B01", ward_code: "W1", room: "R1" },
      { row: 4, code: "B02", ward_code: "W1", room: null },
    ]);
  });

  it("reports a missing column as empty cells, for the server to name", () => {
    if (!beds) throw new Error("no beds sheet");
    expect(rowsFromSheet(beds, [["Bed code"], ["B01"]])).toEqual([
      { row: 2, code: "B01", ward_code: null, room: null },
    ]);
  });
});
