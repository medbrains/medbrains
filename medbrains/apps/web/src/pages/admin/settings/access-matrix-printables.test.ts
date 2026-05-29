// @vitest-environment node

import type { AccessMatrixSurface } from "@medbrains/types";
import { describe, expect, it } from "vitest";
import { buildPrintableCoverage, summarizePrintableCoverage } from "./access-matrix-printables";

function printSurface(input: Partial<AccessMatrixSurface>): AccessMatrixSurface {
  return {
    activatesAfter: [],
    area: "Test",
    fieldAccessKeys: [],
    id: "test.print",
    kind: "print",
    label: "Test printable",
    masking: "none",
    module: "test",
    platforms: ["web"],
    printArtifacts: [],
    printCopies: [],
    printerProfiles: [],
    requiresPrinter: false,
    standardRefs: [],
    ...input,
    requiredPermissions: input.requiredPermissions ?? [],
  };
}

describe("access matrix printable coverage", () => {
  it("requires office and printer routing for customer-facing sheets", () => {
    const [row] = buildPrintableCoverage([
      printSurface({
        id: "billing.receipt_printables",
        label: "Receipt printable",
        printArtifacts: ["Payment receipt"],
        printCopies: ["customer"],
        requiresPrinter: true,
      }),
    ]);

    expect(row?.customerOfficeRequired).toBe(true);
    expect(row?.gaps).toEqual(["missing-office-copy", "missing-printer-profile"]);
  });

  it("does not require customer copies for legal or custody packets", () => {
    const [row] = buildPrintableCoverage([
      printSurface({
        id: "emergency.mlc.printables",
        label: "MLC printables",
        printArtifacts: ["MLC certificate", "Police intimation"],
        printCopies: ["office", "police", "mrd"],
        printerProfiles: ["mlc-secure-printer"],
        requiresPrinter: true,
      }),
    ]);

    expect(row?.customerOfficeRequired).toBe(false);
    expect(row?.gaps).toEqual([]);
  });

  it("reports missing sheet and copy route gaps", () => {
    const rows = buildPrintableCoverage([
      printSurface({
        id: "empty.printable",
        requiresPrinter: false,
      }),
      printSurface({
        id: "complete.printable",
        printArtifacts: ["Patient card"],
        printCopies: ["customer", "office"],
        printerProfiles: ["patient-card"],
        requiresPrinter: true,
      }),
    ]);

    expect(rows.find((row) => row.surfaceId === "empty.printable")?.gaps).toEqual([
      "missing-sheet",
      "missing-copy-route",
    ]);
    expect(summarizePrintableCoverage(rows)).toEqual({
      total: 2,
      complete: 1,
      gaps: 1,
      customerOfficeRequired: 1,
      printerRequired: 1,
    });
  });
});
