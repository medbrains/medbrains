import { Box } from "@mantine/core";
import type { MrdCaseSheetPacket } from "@medbrains/types";
import { buildCopyPrintHtml, copyPrintStyles, type PrintCopyRoute } from "@/utils/printCopies";
import { fmt, type MrdCaseSheetPrintPreview } from "./mrdShared";

function snapshotText(packet: MrdCaseSheetPacket, key: string) {
  const value = packet.source_snapshot[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function snapshotList(packet: MrdCaseSheetPacket, key: string) {
  const value = packet.source_snapshot[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function snapshotNotes(packet: MrdCaseSheetPacket) {
  const value = packet.source_snapshot.datewise_soap_notes;
  return Array.isArray(value)
    ? value.filter(
        (item): item is Record<string, unknown> => item !== null && typeof item === "object",
      )
    : [];
}

function snapshotNoteText(note: Record<string, unknown>, key: string) {
  const value = note[key];
  return typeof value === "string" && value.trim().length > 0 ? value : "—";
}

function snapshotNoteDate(note: Record<string, unknown>) {
  const value = note.date ?? note.created_at;
  return typeof value === "string" ? fmt(value) : "—";
}

function snapshotNoteKey(note: Record<string, unknown>) {
  const id = note.id;
  if (typeof id === "string" && id.length > 0) return id;

  const contentKey = ["date", "created_at", "author", "doctor", "subjective", "assessment", "plan"]
    .map((key) => note[key])
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join("|");
  return contentKey || JSON.stringify(note);
}

function escapeMrdPrintHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
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

export function printMrdCaseSheetPreview(
  title: string,
  element: HTMLElement | null,
  copies: readonly PrintCopyRoute[],
) {
  if (!element) return;
  const popup = window.open("", "_blank", "width=900,height=980");
  if (!popup) return;

  popup.document.write(`
    <html>
      <head>
        <title>${escapeMrdPrintHtml(title)}</title>
        <style>
          body { font-family: Inter, Arial, sans-serif; margin: 24px; color: #18201b; }
          .mrd-print { max-width: 860px; margin: 0 auto; font-size: 12px; line-height: 1.42; }
          .mrd-print h1 { font-size: 18px; margin: 0 0 4px; }
          .mrd-print h2 { font-size: 13px; margin: 18px 0 8px; border-bottom: 1px solid #ccd6cf; padding-bottom: 4px; text-transform: uppercase; letter-spacing: .04em; }
          .mrd-print .muted { color: #5f6b63; }
          .mrd-print .duplicate { color: #b45309; font-weight: 700; }
          .mrd-print-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 18px; margin-top: 12px; }
          .mrd-print-label { color: #5f6b63; font-size: 10px; text-transform: uppercase; letter-spacing: .04em; }
          .mrd-print-value { font-weight: 650; white-space: pre-wrap; }
          .mrd-print table { width: 100%; border-collapse: collapse; margin-top: 8px; }
          .mrd-print th, .mrd-print td { text-align: left; border: 1px solid #d8e1dc; padding: 5px 7px; vertical-align: top; }
          .mrd-print th { background: #f4f7f5; font-size: 10px; text-transform: uppercase; letter-spacing: .04em; }
          .mrd-signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 36px; }
          .mrd-signature { border-top: 1px solid #18201b; padding-top: 6px; text-align: center; color: #5f6b63; }
          ${copyPrintStyles()}
        </style>
      </head>
      <body onload="window.print(); window.close();">
        ${buildCopyPrintHtml(element.innerHTML, copies)}
      </body>
    </html>
  `);
  popup.document.close();
}

function MrdPrintField({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div>
      <div className="mrd-print-label">{label}</div>
      <div className="mrd-print-value">{value || "—"}</div>
    </div>
  );
}

export function MrdCaseSheetPrintablePreview({ preview }: { preview: MrdCaseSheetPrintPreview }) {
  const { action, completeness, packet, pages, reprintReason } = preview;
  const diagnoses = snapshotList(packet, "diagnoses");
  const notes = snapshotNotes(packet);
  const isOpd = packet.packet_type === "opd";
  const missingItems = completeness?.items.filter((item) => item.status !== "ok") ?? [];

  return (
    <Box className="mrd-print">
      <header>
        <h1>MRD Case Sheet Packet</h1>
        <div className="muted">
          {packet.packet_number} | {packet.packet_type.toUpperCase()} | Version {packet.version}
        </div>
        {action === "reprint" && (
          <div className="duplicate">Duplicate / reprint: {reprintReason}</div>
        )}
      </header>

      <section className="mrd-print-grid">
        <MrdPrintField
          label="Patient"
          value={packet.patient_name ?? snapshotText(packet, "patient_name")}
        />
        <MrdPrintField label="UHID" value={packet.uhid ?? snapshotText(packet, "uhid")} />
        <MrdPrintField label="Packet status" value={packet.status} />
        <MrdPrintField label="Generated" value={fmt(packet.generated_at)} />
        <MrdPrintField
          label={isOpd ? "OPD encounter" : "IPD admission"}
          value={isOpd ? packet.encounter_id : packet.admission_id}
        />
        <MrdPrintField label="Department" value={snapshotText(packet, "department")} />
        <MrdPrintField label="Doctor" value={snapshotText(packet, "doctor")} />
        <MrdPrintField
          label={isOpd ? "Encounter date" : "Admission date"}
          value={fmt(
            isOpd ? snapshotText(packet, "encounter_date") : snapshotText(packet, "admitted_at"),
          )}
        />
        {!isOpd && (
          <MrdPrintField
            label="Ward / bed"
            value={`${snapshotText(packet, "ward") ?? "—"} / ${snapshotText(packet, "bed") ?? "—"}`}
          />
        )}
      </section>

      <h2>Clinical Snapshot</h2>
      {isOpd ? (
        <section className="mrd-print-grid">
          <MrdPrintField label="Chief complaint" value={snapshotText(packet, "chief_complaint")} />
          <MrdPrintField label="History" value={snapshotText(packet, "history")} />
          <MrdPrintField label="HPI" value={snapshotText(packet, "hpi")} />
          <MrdPrintField label="Examination" value={snapshotText(packet, "examination")} />
          <MrdPrintField label="Plan" value={snapshotText(packet, "plan")} />
          <MrdPrintField label="Diagnoses" value={diagnoses.join("; ")} />
        </section>
      ) : (
        <section className="mrd-print-grid">
          <MrdPrintField
            label="Provisional diagnosis"
            value={snapshotText(packet, "provisional_diagnosis")}
          />
          <MrdPrintField label="Discharged" value={fmt(snapshotText(packet, "discharged_at"))} />
          <MrdPrintField
            label="Discharge summary"
            value={snapshotText(packet, "discharge_summary")}
          />
        </section>
      )}

      {notes.length > 0 && (
        <>
          <h2>Datewise Notes</h2>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Author</th>
                <th>Subjective</th>
                <th>Objective</th>
                <th>Assessment</th>
                <th>Plan</th>
              </tr>
            </thead>
            <tbody>
              {notes.map((note) => (
                <tr key={snapshotNoteKey(note)}>
                  <td>{snapshotNoteDate(note)}</td>
                  <td>{snapshotNoteText(note, isOpd ? "doctor" : "author")}</td>
                  <td>{snapshotNoteText(note, "subjective")}</td>
                  <td>{snapshotNoteText(note, "objective")}</td>
                  <td>{snapshotNoteText(note, "assessment")}</td>
                  <td>{snapshotNoteText(note, "plan")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <h2>Assembly Checklist</h2>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Page</th>
            <th>Source</th>
            <th>Required</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {pages.map((page) => (
            <tr key={page.id}>
              <td>{page.page_order}</td>
              <td>
                <strong>{page.page_title}</strong>
                <br />
                <span className="muted">{page.page_code}</span>
              </td>
              <td>{page.source_module ?? "manual"}</td>
              <td>{page.is_required ? "Yes" : "No"}</td>
              <td>{page.status}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {completeness && (
        <>
          <h2>Completeness Control</h2>
          <section className="mrd-print-grid">
            <MrdPrintField label="Completeness" value={`${completeness.completeness_pct}%`} />
            <MrdPrintField
              label="Required complete"
              value={`${completeness.complete_total}/${completeness.required_total}`}
            />
            <MrdPrintField label="Open gaps" value={completeness.missing_total} />
          </section>
          {missingItems.length > 0 && (
            <table>
              <thead>
                <tr>
                  <th>Gap</th>
                  <th>Source</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                {missingItems.map((item) => (
                  <tr key={item.code}>
                    <td>{item.label}</td>
                    <td>{item.source_module}</td>
                    <td>{item.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      <div className="mrd-signatures">
        <div className="mrd-signature">Prepared / printed by</div>
        <div className="mrd-signature">MRD received by</div>
      </div>
    </Box>
  );
}
