import { describe, expect, it } from "vitest";
import { exportName, printableReport, toCsv, toSheet } from "./report-export";

describe("report exports", () => {
  it("writes CSV with every column, quoted where it must be", () => {
    const csv = toCsv([
      { ward: "A, east", occupied: 3 },
      { ward: 'Say "hi"', vacant: 2 },
    ]);
    expect(csv).toBe('Ward,Occupied,Vacant\r\n"A, east",3,\r\n"Say ""hi""",,2\r\n');
  });

  it("never lets a value run as a spreadsheet formula", () => {
    expect(toCsv([{ name: '=HYPERLINK("x")' }])).toContain('"\'=HYPERLINK(""x"")"');
    expect(toCsv([{ delta: -4 }])).toContain("\r\n-4\r\n");
  });

  it("gives the sheet a bold header and keeps numbers as numbers", () => {
    const sheet = toSheet([{ samples: 10, ward: "A" }]);
    expect(sheet[0]?.[0]).toEqual({ value: "Samples", fontWeight: "bold" });
    expect(sheet[1]).toEqual([{ value: 10 }, { value: "A" }]);
  });

  it("escapes every value on the printable page", () => {
    const html = printableReport("Beds <today>", [{ ward: "<script>x</script>" }], null);
    expect(html).not.toContain("<script>x");
    expect(html).toContain("&#60;script&#62;");
  });

  it("names the file after the report and the day", () => {
    expect(exportName("Occupancy & queue pressure", "csv")).toMatch(
      /^occupancy-queue-pressure-\d{4}-\d{2}-\d{2}\.csv$/,
    );
  });
});
