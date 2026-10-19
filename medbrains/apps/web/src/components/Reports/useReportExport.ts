import type { EChartsType } from "echarts/core";
import type { RefObject } from "react";
import { toast } from "@/components/ui";
import { downloadBlob } from "@/utils/download";
import { exportName, printableReport, toCsv, toSheet } from "./report-export";

interface Options {
  title: string;
  rows: Record<string, unknown>[];
  chartRef: RefObject<EChartsType | null>;
  link?: string;
}

/** What each export does, for one report chart. */
export function useReportExport({ title, rows, chartRef, link }: Options) {
  const chartPng = () =>
    chartRef.current?.getDataURL({ type: "png", pixelRatio: 2, backgroundColor: "#fff" }) ?? null;

  return {
    csv: () => {
      // A byte-order mark so Excel opens UTF-8 names (Tamil, Hindi) intact.
      downloadBlob(
        new Blob(["﻿", toCsv(rows)], { type: "text/csv;charset=utf-8" }),
        exportName(title, "csv"),
      );
    },
    excel: async () => {
      try {
        // Loaded on demand: most readers never export.
        const { default: writeXlsxFile } = await import("write-excel-file/browser");
        const blob = await writeXlsxFile(toSheet(rows), { sheet: title.slice(0, 31) }).toBlob();
        downloadBlob(blob, exportName(title, "xlsx"));
      } catch {
        toast.error("Could not build the Excel file. Try CSV instead.");
      }
    },
    pdf: () => {
      const page = window.open("", "_blank");
      if (!page) {
        toast.error("Allow pop-ups for this site to export a PDF.");
        return;
      }
      page.document.write(printableReport(title, rows, chartPng()));
      page.document.close();
      page.focus();
      // The browser's print dialog offers Save as PDF.
      page.print();
    },
    image: () => {
      const png = chartPng();
      if (!png) return;
      void fetch(png)
        .then((r) => r.blob())
        .then((blob) => downloadBlob(blob, exportName(title, "png")));
    },
    copyLink: async () => {
      if (!link) return;
      try {
        await navigator.clipboard.writeText(new URL(link, window.location.origin).toString());
        toast.success("Link copied. It opens only for colleagues who may see this report.");
      } catch {
        toast.error("Could not copy the link.");
      }
    },
  };
}
