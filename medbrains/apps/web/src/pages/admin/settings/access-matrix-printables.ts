import type { AccessMatrixPrintCopy, AccessMatrixSurface } from "@medbrains/types";

export type PrintableCoverageGap =
  | "missing-sheet"
  | "missing-copy-route"
  | "missing-customer-copy"
  | "missing-office-copy"
  | "missing-printer-profile";

export interface PrintableCoverageRow {
  surfaceId: string;
  module: string;
  label: string;
  route: string | null;
  artifacts: readonly string[];
  copies: readonly AccessMatrixPrintCopy[];
  printerProfiles: readonly string[];
  requiresPrinter: boolean;
  customerOfficeRequired: boolean;
  gaps: readonly PrintableCoverageGap[];
}

export interface PrintableCoverageSummary {
  total: number;
  complete: number;
  gaps: number;
  customerOfficeRequired: number;
  printerRequired: number;
}

const CUSTOMER_OFFICE_ARTIFACT_TERMS = [
  "advice",
  "bill",
  "card",
  "certificate",
  "confirmation",
  "consent",
  "form",
  "invoice",
  "label",
  "prescription",
  "receipt",
  "referral",
  "registration",
  "report",
  "slip",
  "summary",
  "token",
] as const;

const CUSTODY_ONLY_ARTIFACT_TERMS = [
  "case-sheet",
  "case sheet",
  "court",
  "extract",
  "mar chart",
  "mlc",
  "police",
  "register",
  "vital signs chart",
  "wristband",
] as const;

export const PRINTABLE_COVERAGE_GAP_LABELS: Record<PrintableCoverageGap, string> = {
  "missing-sheet": "sheet not mapped",
  "missing-copy-route": "copy route missing",
  "missing-customer-copy": "customer copy missing",
  "missing-office-copy": "office copy missing",
  "missing-printer-profile": "printer profile missing",
};

function normalizedIncludes(value: string, terms: readonly string[]) {
  const normalized = value.toLowerCase();
  return terms.some((term) => normalized.includes(term));
}

function artifactRequiresCustomerOffice(artifact: string) {
  if (normalizedIncludes(artifact, CUSTODY_ONLY_ARTIFACT_TERMS)) return false;
  return normalizedIncludes(artifact, CUSTOMER_OFFICE_ARTIFACT_TERMS);
}

function surfaceRequiresCustomerOffice(
  surface: AccessMatrixSurface,
  copies: Set<AccessMatrixPrintCopy>,
) {
  if (copies.has("customer")) return true;
  return surface.printArtifacts.some((artifact) => artifactRequiresCustomerOffice(artifact));
}

function printableSurface(surface: AccessMatrixSurface) {
  return (
    surface.kind === "print" ||
    surface.printArtifacts.length > 0 ||
    surface.printCopies.length > 0 ||
    surface.requiresPrinter
  );
}

export function buildPrintableCoverage(
  surfaces: readonly AccessMatrixSurface[],
): PrintableCoverageRow[] {
  return surfaces
    .filter(printableSurface)
    .map((surface) => {
      const copies = new Set(surface.printCopies);
      const customerOfficeRequired = surfaceRequiresCustomerOffice(surface, copies);
      const gaps: PrintableCoverageGap[] = [];

      if (surface.printArtifacts.length === 0) gaps.push("missing-sheet");
      if (surface.printCopies.length === 0) gaps.push("missing-copy-route");
      if (customerOfficeRequired && !copies.has("customer")) gaps.push("missing-customer-copy");
      if (customerOfficeRequired && !copies.has("office")) gaps.push("missing-office-copy");
      if (surface.requiresPrinter && surface.printerProfiles.length === 0) {
        gaps.push("missing-printer-profile");
      }

      return {
        surfaceId: surface.id,
        module: surface.module,
        label: surface.label,
        route: surface.route ?? null,
        artifacts: surface.printArtifacts,
        copies: surface.printCopies,
        printerProfiles: surface.printerProfiles,
        requiresPrinter: surface.requiresPrinter,
        customerOfficeRequired,
        gaps,
      };
    })
    .sort((left, right) => left.surfaceId.localeCompare(right.surfaceId));
}

export function summarizePrintableCoverage(
  rows: readonly PrintableCoverageRow[],
): PrintableCoverageSummary {
  const gaps = rows.filter((row) => row.gaps.length > 0).length;

  return {
    total: rows.length,
    complete: rows.length - gaps,
    gaps,
    customerOfficeRequired: rows.filter((row) => row.customerOfficeRequired).length,
    printerRequired: rows.filter((row) => row.requiresPrinter).length,
  };
}
