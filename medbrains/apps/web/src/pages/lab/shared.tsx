// Shared lab helpers — status/flag/priority badge maps + lab-report print builders extracted
// from lab.tsx so tab/section components can be split into their own files without a cycle.

import { notifications } from "@mantine/notifications";
import type { LabPriority, LabReportPrintData, LabResultFlag } from "@medbrains/types";
import type { BadgeTone } from "@/components/ui";
import { labService } from "@/services/lab.service";
import { buildCopyPrintHtml, copyPrintStyles, PRINT_COPY_PACKETS } from "@/utils/printCopies";

export const statusColors: Record<string, string> = {
  ordered: "primary",
  sample_collected: "info",
  processing: "warning",
  completed: "orange",
  verified: "success",
  cancelled: "danger",
};

export const BADGE_TONE_BY_COLOR: Record<string, BadgeTone> = {
  primary: "primary",
  info: "info",
  success: "success",
  warning: "warning",
  danger: "danger",
  accent: "accent",
  neutral: "neutral",
  gray: "neutral",
  slate: "neutral",
  teal: "success",
  green: "success",
  orange: "warning",
  yellow: "warning",
  blue: "info",
  violet: "accent",
};

export function toBadgeTone(color: string | null | undefined): BadgeTone {
  return (color && BADGE_TONE_BY_COLOR[color]) || "neutral";
}

export function toLabPriority(value: string | null): LabPriority {
  if (value === "urgent" || value === "stat") return value;
  return "routine";
}

export function toLabResultFlag(value: string | null): LabResultFlag | undefined {
  switch (value) {
    case "normal":
    case "low":
    case "high":
    case "critical_low":
    case "critical_high":
    case "abnormal":
      return value;
    default:
      return undefined;
  }
}

export const flagColors: Record<string, BadgeTone> = {
  normal: "success",
  low: "primary",
  high: "warning",
  critical_low: "danger",
  critical_high: "danger",
  abnormal: "warning",
};

export const phlebotomyStatusColors: Record<string, BadgeTone> = {
  waiting: "warning",
  in_progress: "primary",
  completed: "success",
  skipped: "neutral",
};

export const LAB_REPORT_PRINT_COPIES = PRINT_COPY_PACKETS.labReport;

export function escapeLabPrintText(value: unknown) {
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

export function labPrintValue(value: string | null | undefined, fallback = "-") {
  return escapeLabPrintText(value?.trim() || fallback);
}

export function labFlagClass(flag: string | null) {
  if (!flag) return "";
  return flag.includes("critical") ? "critical" : flag === "normal" ? "normal" : "abnormal";
}

export function buildLabReportContent(data: LabReportPrintData) {
  const resultRows =
    data.results.length > 0
      ? data.results
          .map(
            // Previous value and delta are printed, not just shown on screen.
            // The delta check is a safety control, and the clinician holding
            // the paper is the one who has to act on it.
            (result) => `
              <tr class="${labFlagClass(result.flag)}">
                <td>${labPrintValue(result.parameter_name)}</td>
                <td>${labPrintValue(result.value)}</td>
                <td>${labPrintValue(result.unit)}</td>
                <td>${labPrintValue(result.normal_range)}</td>
                <td>${labPrintValue(result.previous_value, "—")}</td>
                <td>${
                  result.delta_percent
                    ? `${result.is_delta_flagged ? "&#916; " : ""}${result.delta_percent}%`
                    : "—"
                }</td>
                <td>${labPrintValue(result.flag)}</td>
              </tr>
            `,
          )
          .join("")
      : '<tr><td colspan="7" class="empty-row">No result lines recorded</td></tr>';

  return `
    <section class="lab-report-print">
      <header class="report-header">
        <div>
          <h1>Laboratory Report</h1>
          <div class="report-subtitle">${labPrintValue(data.test_name)}</div>
        </div>
        <div class="report-number">${labPrintValue(data.order_number, "Order pending")}</div>
      </header>

      <dl class="report-grid">
        <dt>Patient</dt><dd>${labPrintValue(data.patient_name)} (${labPrintValue(data.uhid)})</dd>
        <dt>Age / Gender</dt><dd>${labPrintValue(data.age)} / ${labPrintValue(data.gender)}</dd>
        <dt>Sample</dt><dd>${labPrintValue(data.sample_type)}</dd>
        <dt>Collected</dt><dd>${labPrintValue(data.collected_at)}</dd>
        <dt>Reported</dt><dd>${labPrintValue(data.reported_at)}</dd>
        <dt>Referring doctor</dt><dd>${labPrintValue(data.referring_doctor)}</dd>
      </dl>

      <table>
        <thead>
          <tr>
            <th>Parameter</th>
            <th>Result</th>
            <th>Unit</th>
            <th>Reference range</th>
            <th>Previous</th>
            <th>Delta</th>
            <th>Flag</th>
          </tr>
        </thead>
        <tbody>${resultRows}</tbody>
      </table>

      <footer class="report-footer">
        <div>Verified by: ${labPrintValue(data.pathologist_name)}</div>
        <div>Generated: ${escapeLabPrintText(new Date().toLocaleString("en-IN"))}</div>
      </footer>
    </section>
  `;
}

export function writeLabReportPrintPacket(win: Window, data: LabReportPrintData) {
  const content = buildLabReportContent(data);
  win.document.open();
  win.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Lab Report ${labPrintValue(data.uhid)}</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: Arial, sans-serif; padding: 18px; color: #101918; font-size: 12px; }
          .lab-report-print { border: 1px solid #cfd8dc; padding: 16px; border-radius: 6px; }
          .report-header { display: flex; justify-content: space-between; gap: 12px; border-bottom: 2px solid #1f2937; padding-bottom: 10px; margin-bottom: 12px; }
          h1 { font-size: 18px; margin: 0; }
          .report-subtitle { margin-top: 4px; color: #475569; font-weight: 700; }
          .report-number { font-weight: 700; color: #0f6b75; white-space: nowrap; }
          .report-grid { display: grid; grid-template-columns: 130px 1fr 130px 1fr; gap: 7px 12px; margin: 0 0 14px; }
          .report-grid dt { color: #475569; font-weight: 700; }
          .report-grid dd { margin: 0; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; }
          th, td { border: 1px solid #cbd5e1; padding: 7px 8px; text-align: left; vertical-align: top; }
          th { background: #f1f5f9; font-weight: 700; }
          tr.normal td { color: #166534; }
          tr.abnormal td { color: #b45309; font-weight: 700; }
          tr.critical td { color: #b91c1c; font-weight: 800; }
          .empty-row { text-align: center; color: #64748b; }
          .report-footer { display: flex; justify-content: space-between; gap: 12px; border-top: 1px solid #cbd5e1; margin-top: 16px; padding-top: 10px; color: #475569; }
          ${copyPrintStyles()}
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        ${buildCopyPrintHtml(content, LAB_REPORT_PRINT_COPIES)}
        <script>window.onload = function() { window.print(); window.close(); }</script>
      </body>
    </html>
  `);
  win.document.close();
}

export async function printLabReportPacket(orderId: string) {
  const win = window.open("", "_blank", "width=820,height=900");
  if (!win) {
    notifications.show({
      title: "Print blocked",
      message: "Allow pop-ups to print the lab report packet.",
      color: "warning",
    });
    return;
  }

  win.document.write(`
    <!DOCTYPE html>
    <html><head><title>Preparing lab report</title></head>
    <body style="font-family:Arial,sans-serif;padding:20px;">Preparing lab report...</body></html>
  `);
  win.document.close();

  try {
    const data = await labService.getLabReportPrintData(orderId);
    writeLabReportPrintPacket(win, data);
  } catch (error) {
    win.close();
    notifications.show({
      title: "Print failed",
      message: error instanceof Error ? error.message : "Unable to load lab report print data.",
      color: "danger",
    });
  }
}

/** How a finished report can leave the lab. */
export const LAB_DISPATCH_METHOD_OPTIONS = [
  { value: "counter", label: "Collected at the counter" },
  { value: "email", label: "Email" },
  { value: "sms", label: "SMS" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "portal", label: "Patient portal" },
  { value: "courier", label: "Courier" },
];
