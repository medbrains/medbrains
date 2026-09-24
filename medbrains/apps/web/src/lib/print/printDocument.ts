import { printDocumentDef } from "./print-registry";

/**
 * Print any document, from anywhere, in one call.
 *
 *     await printDocument("consent.general", admissionId);
 *
 * That is the whole interface. The caller names the template and the record;
 * everything else — which endpoint holds that document's fields, what the
 * server will enforce, how it reaches paper — is the registry's problem.
 *
 * Eight screens had hand-rolled their own window.open/document.write/print
 * dance, and roughly fifty documents had no way to be printed at all because
 * writing a ninth was nobody's job.
 */
export interface PrintDocumentResult {
  ok: boolean;
  /** Present when the document could not be printed, phrased for a user. */
  problem?: string;
}

/** Escape for interpolation into the print window's HTML. */
function esc(value: unknown): string {
  if (value == null) return "—";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function humanise(key: string): string {
  return key.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

/**
 * Render the document's fields as a printable sheet.
 *
 * Deliberately generic: a document with no curated layout still prints every
 * field it carries, which is worth more than a document that cannot be printed
 * because nobody has drawn it yet. Curated templates supersede this per key.
 */
function renderSheet(title: string, data: Record<string, unknown>): string {
  return `<h1>${esc(title)}</h1>${renderFields(data)}`;
}

/**
 * Scalars as a table, then anything nested as its own section.
 *
 * This used to drop every object-valued field on the floor, which meant a
 * document whose substance is nested printed only its letterhead. The WHO
 * surgical safety checklist is three phases of tick-boxes under `phases`: the
 * sheet came out with the patient's name, the theatre number, and no checklist.
 * A form that looks complete and carries none of its content is the worst of
 * the three outcomes — worse than not printing at all, because it gets filed.
 */
function renderFields(data: Record<string, unknown>): string {
  const entries = Object.entries(data);
  const scalars = entries.filter(([, v]) => typeof v !== "object" || v === null);
  const nested = entries.filter(([, v]) => typeof v === "object" && v !== null);

  const rows = scalars
    .map(([key, value]) => `<tr><th>${esc(humanise(key))}</th><td>${esc(value)}</td></tr>`)
    .join("");
  const table = rows ? `<table>${rows}</table>` : "";

  const sections = nested
    .map(([key, value]) => {
      const body = Array.isArray(value)
        ? value.map((item) => renderItem(item)).join("")
        : renderItem(value);
      return `<section><h2>${esc(humanise(key))}</h2>${body}</section>`;
    })
    .join("");

  return table + sections;
}

/** One nested value: an object becomes its own block, a scalar a line. */
function renderItem(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return `<p>${esc(value)}</p>`;
  }
  const record = value as Record<string, unknown>;
  // A tick-box list — {label, checked} — is the shape a checklist arrives in,
  // and prints as a box so the sheet reads the way the paper one does.
  if ("checked" in record && ("label" in record || "key" in record)) {
    const mark = record.checked === true ? "[x]" : "[ ]";
    return `<p class="tick">${esc(mark)} ${esc(record.label ?? record.key)}</p>`;
  }
  const heading = typeof record.label === "string" ? `<h3>${esc(record.label)}</h3>` : "";
  return `<div class="block">${heading}${renderFields(record)}</div>`;
}

const PRINT_CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { padding: 24px; font: 13px/1.5 "IBM Plex Sans", system-ui, sans-serif; color: #161616; }
  h1 { font-size: 18px; font-weight: 600; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #e0e0e0; vertical-align: top; }
  th { width: 34%; font-weight: 600; color: #525252; }
  h2 { font-size: 14px; font-weight: 600; margin: 18px 0 6px; }
  h3 { font-size: 13px; font-weight: 600; margin: 10px 0 4px; }
  section { margin-top: 8px; }
  .block { margin: 8px 0 12px; padding-left: 10px; border-left: 2px solid #e0e0e0; }
  .tick { font-family: "IBM Plex Mono", monospace; padding: 2px 0; }
  @media print { body { padding: 0; } }
`;

export async function printDocument(
  documentKey: string,
  recordId: string,
): Promise<PrintDocumentResult> {
  const def = printDocumentDef(documentKey);
  if (!def) {
    return { ok: false, problem: `No printable document is registered as "${documentKey}".` };
  }
  if (!recordId) {
    return { ok: false, problem: `${def.label} needs a ${def.idKind} to print.` };
  }

  let data: Record<string, unknown>;
  try {
    data = (await def.fetch(recordId)) as Record<string, unknown>;
  } catch (error) {
    // A failed fetch is not an empty document. Printing a blank consent form
    // would be worse than printing nothing.
    return {
      ok: false,
      problem: `${def.label} could not be loaded: ${(error as Error).message}`,
    };
  }

  // Opened before the await would be lost to the popup blocker; opened after,
  // it is a direct consequence of the click that started this.
  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) {
    return {
      ok: false,
      problem: "The print window was blocked. Allow pop-ups for this site and try again.",
    };
  }

  win.document.write(
    `<!DOCTYPE html><html><head><title>${esc(def.label)}</title>` +
      `<style>${PRINT_CSS}</style></head><body>` +
      renderSheet(def.label, data) +
      `<script>window.onload=function(){window.print();window.close();}</script>` +
      `</body></html>`,
  );
  win.document.close();
  return { ok: true };
}
