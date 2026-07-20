// Radiology shared helpers — split from radiology.tsx (pure move).

import { notifications } from "@mantine/notifications";
import type { RadiologyReportPrintData } from "@medbrains/types";
import type { BadgeTone } from "@/components/ui";
import { radiologyService } from "@/services/radiology.service";
import { buildCopyPrintHtml, copyPrintStyles, PRINT_COPY_PACKETS } from "@/utils/printCopies";

export const statusColors: Record<string, string> = {
  ordered: "primary",
  scheduled: "info",
  in_progress: "warning",
  completed: "orange",
  reported: "teal",
  verified: "success",
  cancelled: "danger",
};

const RADIOLOGY_REPORT_PRINT_COPIES = PRINT_COPY_PACKETS.radiologyReport;

function escapeRadiologyPrintText(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[char] ?? char;
  });
}

function radiologyPrintValue(value: string | null | undefined, fallback = "-") {
  return escapeRadiologyPrintText(value?.trim() || fallback);
}

function buildRadiologyReportContent(data: RadiologyReportPrintData) {
  return `
    <section class="radiology-report-print">
      <header class="report-header">
        <div>
          <h1>Radiology Report</h1>
          <div class="report-subtitle">${radiologyPrintValue(data.modality)} ${radiologyPrintValue(data.body_part)}</div>
        </div>
        <div class="report-date">${radiologyPrintValue(data.date)}</div>
      </header>

      <dl class="report-grid">
        <dt>Patient</dt><dd>${radiologyPrintValue(data.patient_name)} (${radiologyPrintValue(data.uhid)})</dd>
        <dt>Age / Gender</dt><dd>${radiologyPrintValue(data.age)} / ${radiologyPrintValue(data.gender)}</dd>
        <dt>Modality</dt><dd>${radiologyPrintValue(data.modality)}</dd>
        <dt>Body part</dt><dd>${radiologyPrintValue(data.body_part)}</dd>
        <dt>Indication</dt><dd class="span-all">${radiologyPrintValue(data.clinical_indication)}</dd>
      </dl>

      <section class="report-section">
        <h2>Findings</h2>
        <p>${radiologyPrintValue(data.findings)}</p>
      </section>
      <section class="report-section">
        <h2>Impression</h2>
        <p>${radiologyPrintValue(data.impression)}</p>
      </section>
      <section class="report-section">
        <h2>Recommendations</h2>
        <p>${radiologyPrintValue(data.recommendations)}</p>
      </section>

      <footer class="report-footer">
        <div>Reported by: ${radiologyPrintValue(data.reported_by)}</div>
        <div>Verified by: ${radiologyPrintValue(data.verified_by)}</div>
        <div>Generated: ${escapeRadiologyPrintText(new Date().toLocaleString("en-IN"))}</div>
      </footer>
    </section>
  `;
}

function writeRadiologyReportPrintPacket(win: Window, data: RadiologyReportPrintData) {
  const content = buildRadiologyReportContent(data);
  win.document.open();
  win.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Radiology Report ${radiologyPrintValue(data.uhid)}</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: Arial, sans-serif; padding: 18px; color: #101918; font-size: 12px; }
          .radiology-report-print { border: 1px solid #cfd8dc; padding: 16px; border-radius: 6px; }
          .report-header { display: flex; justify-content: space-between; gap: 12px; border-bottom: 2px solid #1f2937; padding-bottom: 10px; margin-bottom: 12px; }
          h1 { font-size: 18px; margin: 0; }
          h2 { font-size: 13px; margin: 0 0 6px; color: #334155; }
          .report-subtitle { margin-top: 4px; color: #475569; font-weight: 700; }
          .report-date { font-weight: 700; color: #0f6b75; white-space: nowrap; }
          .report-grid { display: grid; grid-template-columns: 130px 1fr 130px 1fr; gap: 7px 12px; margin: 0 0 14px; }
          .report-grid dt { color: #475569; font-weight: 700; }
          .report-grid dd { margin: 0; }
          .span-all { grid-column: span 3; }
          .report-section { border-top: 1px solid #e2e8f0; padding-top: 10px; margin-top: 10px; }
          .report-section p { margin: 0; white-space: pre-wrap; line-height: 1.55; }
          .report-footer { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; border-top: 1px solid #cbd5e1; margin-top: 18px; padding-top: 10px; color: #475569; }
          ${copyPrintStyles()}
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        ${buildCopyPrintHtml(content, RADIOLOGY_REPORT_PRINT_COPIES)}
        <script>window.onload = function() { window.print(); window.close(); }</script>
      </body>
    </html>
  `);
  win.document.close();
}

export async function printRadiologyReportPacket(orderId: string) {
  const win = window.open("", "_blank", "width=820,height=900");
  if (!win) {
    notifications.show({
      title: "Print blocked",
      message: "Allow pop-ups to print the radiology report packet.",
      color: "warning",
    });
    return;
  }

  win.document.write(`
    <!DOCTYPE html>
    <html><head><title>Preparing radiology report</title></head>
    <body style="font-family:Arial,sans-serif;padding:20px;">Preparing radiology report...</body></html>
  `);
  win.document.close();

  try {
    const data = await radiologyService.getRadiologyPrintData(orderId);
    writeRadiologyReportPrintPacket(win, data);
  } catch (error) {
    win.close();
    notifications.show({
      title: "Print failed",
      message:
        error instanceof Error ? error.message : "Unable to load radiology report print data.",
      color: "danger",
    });
  }
}

export function colorToBadgeTone(color: string | null | undefined): BadgeTone {
  switch (color) {
    case "primary":
      return "primary";
    case "info":
    case "blue":
      return "info";
    case "warning":
    case "orange":
    case "yellow":
      return "warning";
    case "teal":
    case "green":
    case "success":
      return "success";
    case "danger":
    case "red":
      return "danger";
    case "violet":
    case "grape":
    case "rose":
    case "cinnabar":
      return "accent";
    default:
      return "neutral";
  }
}
