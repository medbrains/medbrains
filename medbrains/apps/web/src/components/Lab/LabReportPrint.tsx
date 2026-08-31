import { useHasPermission } from "@medbrains/stores";
import type { LabParameter, LabReportFullPrintData } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPrinter } from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import { Button, toast } from "@/components/ui";
import { labService } from "@/services/lab.service";

/**
 * Prints a released lab report.
 *
 * Everything behind this already existed — a guarded handler, a complete data
 * shape carrying NABL accreditation, the pathologist's registration number,
 * amendments and per-analyte deltas, and an API client method. Nothing in the
 * application called it, so a verified result could be read on screen and not
 * handed to the patient.
 *
 * A4 rather than thermal. A lab report is a document that goes into a file and
 * gets carried to another hospital; the 58mm slip is the patient card, and the
 * two are not interchangeable.
 */
export function PrintLabReportButton({
  orderId,
  disabled,
}: {
  orderId: string;
  disabled?: boolean;
}) {
  const canPrint = useHasPermission(P.LAB.REPORTS_VIEW);

  const print = useMutation({
    mutationFn: () => labService.getLabReportFullPrintData(orderId),
    onSuccess: openReportWindow,
    onError: (error: Error) => toast.error(error.message, { title: "Could not print the report" }),
  });

  if (!canPrint) return null;

  return (
    <Button
      tone="secondary"
      size="xs"
      leftSection={<IconPrinter size={14} />}
      loading={print.isPending}
      disabled={disabled}
      onClick={() => print.mutate()}
    >
      Print Report
    </Button>
  );
}

/**
 * Escapes text before it reaches the print document.
 *
 * Every string here is clinician- or patient-supplied and arrives as raw HTML.
 * An interpretation containing "<" must print as itself rather than swallow
 * the rest of the report.
 */
function esc(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fieldRow(label: string, value: string | null | undefined): string {
  // Absent fields are dropped, not printed empty. A report showing "Ward: —"
  // for an outpatient invites the reader to wonder which ward.
  if (!value) return "";
  return `<tr><th>${esc(label)}</th><td>${esc(value)}</td></tr>`;
}

function parameterRow(p: LabParameter): string {
  // Abnormal is carried by weight and a marker, never by colour alone: these
  // reports are printed on monochrome laser printers and photocopied, and a
  // red number becomes a grey one.
  const marker = p.is_critical ? " **" : p.is_abnormal ? " *" : "";
  const cls = p.is_critical ? "critical" : p.is_abnormal ? "abnormal" : "";
  const delta =
    p.previous_value && p.delta_percent
      ? `<span class="delta${p.is_delta_flagged ? " flagged" : ""}">prev ${esc(
          p.previous_value,
        )} (${esc(p.delta_percent)}%)</span>`
      : "";
  return `<tr class="${cls}">
    <td>${esc(p.parameter_name)}${p.method ? `<span class="method">${esc(p.method)}</span>` : ""}</td>
    <td class="val">${esc(p.result_value)}${marker}${delta}</td>
    <td>${esc(p.unit)}</td>
    <td>${esc(p.reference_range)}</td>
  </tr>`;
}

function openReportWindow(data: LabReportFullPrintData) {
  const win = window.open("", "_blank", "width=900,height=1100");
  if (!win) {
    toast.error("Allow pop-ups for this site to print the report", {
      title: "The print window was blocked",
    });
    return;
  }

  const anyAbnormal = data.parameters.some((p) => p.is_abnormal || p.is_critical);
  const anyCritical = data.parameters.some((p) => p.is_critical);

  win.document.write(`<!DOCTYPE html>
<html>
  <head>
    <title>${esc(data.test_name)} — ${esc(data.uhid)}</title>
    <style>
      @page { size: A4; margin: 14mm 12mm 18mm; }
      * { box-sizing: border-box; }
      body { margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 10pt; color: #000; }
      h1 { font-size: 13pt; margin: 0 0 1mm; }
      .hospital { font-size: 8pt; margin: 0 0 3mm; }
      .banner {
        border: 1.5pt solid #000; padding: 2mm 3mm; margin: 0 0 4mm;
        font-weight: 700; font-size: 10pt;
      }
      table { border-collapse: collapse; width: 100%; }
      .meta { margin: 0 0 4mm; font-size: 9pt; }
      .meta th { text-align: left; font-weight: 600; padding: .6mm 4mm .6mm 0; white-space: nowrap; }
      .meta td { padding: .6mm 8mm .6mm 0; }
      .results { margin: 0 0 4mm; }
      .results th {
        text-align: left; border-bottom: 1pt solid #000; padding: 1.5mm 2mm;
        font-size: 9pt; text-transform: uppercase; letter-spacing: .04em;
      }
      .results td { padding: 1.5mm 2mm; border-bottom: .4pt solid #999; vertical-align: top; }
      .results tr.abnormal td { font-weight: 700; }
      .results tr.critical td { font-weight: 700; background: #eee; }
      .results td.val { font-family: "Courier New", monospace; }
      .method { display: block; font-size: 7.5pt; font-weight: 400; color: #333; }
      .delta { display: block; font-family: Arial, sans-serif; font-size: 7.5pt; color: #333; }
      .delta.flagged { font-weight: 700; }
      .note { font-size: 8pt; margin: 0 0 3mm; }
      .interp { border-top: .4pt solid #999; padding-top: 2mm; margin: 0 0 4mm; font-size: 9pt; }
      .sigs { margin-top: 8mm; display: flex; gap: 16mm; }
      .sig { font-size: 8.5pt; }
      .sig .line { border-top: .6pt solid #000; width: 52mm; margin-bottom: 1mm; }
      .foot { margin-top: 6mm; border-top: .4pt solid #999; padding-top: 2mm; font-size: 7.5pt; }
      /* Repeat the column headings when a long panel breaks across pages, and
         never split a parameter's own row. */
      thead { display: table-header-group; }
      tr { page-break-inside: avoid; }
    </style>
  </head>
  <body>
    <h1>${esc(data.hospital_name)}</h1>
    <p class="hospital">
      Laboratory report${data.department ? ` — ${esc(data.department)}` : ""}
      ${data.nabl_accredited ? ` · NABL accredited${data.nabl_certificate_number ? ` (${esc(data.nabl_certificate_number)})` : ""}` : ""}
    </p>

    ${
      data.report_status && data.report_status.toLowerCase() !== "final"
        ? `<p class="banner">${esc(data.report_status.toUpperCase())} REPORT — not for clinical decisions until finalised</p>`
        : ""
    }
    ${
      data.amendments.length > 0
        ? `<p class="banner">AMENDED — this report corrects a copy already issued</p>`
        : ""
    }

    <table class="meta">
      ${fieldRow("Patient", data.patient_name)}
      ${fieldRow("UHID", data.uhid)}
      ${fieldRow("Age / Sex", [data.age_display, data.gender].filter(Boolean).join(" / "))}
      ${fieldRow("Sample", data.sample_id)}
      ${fieldRow("Accession", data.accession_number)}
      ${fieldRow("Specimen", data.specimen_type)}
      ${fieldRow("Collected", data.collection_date)}
      ${fieldRow("Reported", data.report_date)}
      ${fieldRow("Referred by", data.referring_doctor)}
    </table>

    <table class="results">
      <thead>
        <tr><th>Investigation</th><th>Result</th><th>Unit</th><th>Reference range</th></tr>
      </thead>
      <tbody>
        ${data.parameters.map(parameterRow).join("")}
      </tbody>
    </table>

    ${
      anyAbnormal
        ? `<p class="note">* outside the reference range${anyCritical ? " · ** critical — the ordering clinician was informed" : ""}</p>`
        : ""
    }

    ${data.interpretation ? `<div class="interp"><strong>Interpretation.</strong> ${esc(data.interpretation)}</div>` : ""}
    ${data.comments ? `<div class="interp">${esc(data.comments)}</div>` : ""}

    ${
      data.amendments.length > 0
        ? `<div class="interp"><strong>Amendments.</strong><br/>${data.amendments
            .map(
              (a) =>
                // What changed, not merely that something did. The copy
                // already in somebody's hand still shows the old number, so
                // the old number has to appear here for them to find it.
                `${esc(a.parameter_name)}: ${esc(a.original_value)} \u2192 ${esc(a.amended_value)} — ${esc(a.reason)} (${esc(a.amended_at)}${a.amended_by_name ? `, ${esc(a.amended_by_name)}` : ""})`,
            )
            .join("<br/>")}</div>`
        : ""
    }

    <div class="sigs">
      ${
        data.technician_name
          ? `<div class="sig"><div class="line"></div>${esc(data.technician_name)}<br/>Performed by</div>`
          : ""
      }
      <div class="sig">
        <div class="line"></div>${esc(data.pathologist_name)}
        ${data.pathologist_registration_number ? `<br/>Reg. ${esc(data.pathologist_registration_number)}` : ""}
        <br/>Verified by${data.verified_at ? ` · ${esc(data.verified_at)}` : ""}
      </div>
    </div>

    <p class="foot">
      ${esc(data.barcode_data)} · Results relate only to the sample tested.
      ${data.loinc_code ? ` LOINC ${esc(data.loinc_code)}.` : ""}
    </p>
    <script>
      window.onload = function () {
        window.print();
        window.close();
      };
    </script>
  </body>
</html>`);
  win.document.close();
}
