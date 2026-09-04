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
  const rows = Object.entries(data)
    .filter(([, value]) => typeof value !== "object" || value === null)
    .map(([key, value]) => `<tr><th>${esc(humanise(key))}</th><td>${esc(value)}</td></tr>`)
    .join("");
  return `<h1>${esc(title)}</h1><table>${rows}</table>`;
}

const PRINT_CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { padding: 24px; font: 13px/1.5 "IBM Plex Sans", system-ui, sans-serif; color: #161616; }
  h1 { font-size: 18px; font-weight: 600; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #e0e0e0; vertical-align: top; }
  th { width: 34%; font-weight: 600; color: #525252; }
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
