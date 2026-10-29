// A statutory sheet -- named columns, rows of text -- as a CSV to upload or a
// page to print. Shared by the Ni-kshay sheet and the IHIP line lists.

import { toast } from "@/components/ui";
import { downloadBlob } from "@/utils/download";
import { exportName, printableReport, toCsv } from "./report-export";

export interface StatutorySheet {
  columns: string[];
  rows: string[][];
}

/** Each row keyed by its column, in the form's order. */
export function sheetRows(sheet: StatutorySheet): Record<string, string>[] {
  return sheet.rows.map((cells) =>
    Object.fromEntries(sheet.columns.map((col, i) => [col, cells[i] ?? ""])),
  );
}

export function downloadSheetCsv(sheet: StatutorySheet, fileTitle: string): void {
  // A byte-order mark so Excel opens UTF-8 names (Tamil, Hindi) intact.
  downloadBlob(
    new Blob(["﻿", toCsv(sheetRows(sheet))], { type: "text/csv;charset=utf-8" }),
    exportName(fileTitle, "csv"),
  );
}

export function printSheet(sheet: StatutorySheet, title: string): void {
  const page = window.open("", "_blank");
  if (!page) {
    toast.error("Allow pop-ups for this site to print the sheet.");
    return;
  }
  page.document.write(printableReport(title, sheetRows(sheet), null));
  page.document.close();
  page.print();
}
