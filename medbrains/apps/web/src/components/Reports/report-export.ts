/**
 * A report's rows as files: CSV, an Excel sheet, and a printable page (the
 * browser's own Save as PDF). From the rows the reader already sees, so an
 * export never holds more than the screen did.
 */

type Row = Record<string, unknown>;

/** Every column any row has, in first-seen order. */
export function columnsOf(rows: Row[]): string[] {
  const seen = new Set<string>();
  for (const row of rows) for (const key of Object.keys(row)) seen.add(key);
  return [...seen];
}

const humanise = (key: string) => key.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

function text(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/**
 * A cell a spreadsheet would run as a formula — `=HYPERLINK(...)` typed into
 * a patient's name — is written as text: prefixed, so it reads as written.
 */
const FORMULA_START = /^[=+\-@\t\r]/;

function csvCell(value: unknown): string {
  let s = text(value);
  if (typeof value === "string" && FORMULA_START.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: Row[]): string {
  const cols = columnsOf(rows);
  const lines = [cols.map((c) => csvCell(humanise(c))).join(",")];
  for (const row of rows) lines.push(cols.map((c) => csvCell(row[c])).join(","));
  return `${lines.join("\r\n")}\r\n`;
}

/** The sheet for `write-excel-file`: a bold header row, then the values. */
export function toSheet(rows: Row[]) {
  const cols = columnsOf(rows);
  const cell = (value: unknown) =>
    value === null || value === undefined
      ? null
      : { value: typeof value === "number" || typeof value === "boolean" ? value : text(value) };
  return [
    cols.map((c) => ({ value: humanise(c), fontWeight: "bold" as const })),
    ...rows.map((row) => cols.map((c) => cell(row[c]))),
  ];
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** A printable page: title, when, the chart as an image, and every row. */
export function printableReport(title: string, rows: Row[], chartPng: string | null): string {
  const cols = columnsOf(rows);
  const head = cols.map((c) => `<th>${escapeHtml(humanise(c))}</th>`).join("");
  const body = rows
    .map((r) => `<tr>${cols.map((c) => `<td>${escapeHtml(text(r[c]))}</td>`).join("")}</tr>`)
    .join("");
  const image = chartPng ? `<img alt="${escapeHtml(title)} chart" src="${chartPng}">` : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>body{font:12px system-ui,sans-serif;margin:24px;color:#161616}h1{font-size:18px;margin:0 0 4px}
p{color:#525252;margin:0 0 16px}img{max-width:100%;margin-bottom:16px}table{border-collapse:collapse;width:100%}
th,td{border:1px solid #c6c6c6;padding:4px 6px;text-align:left}th{background:#f4f4f4}</style></head>
<body><h1>${escapeHtml(title)}</h1><p>Generated ${escapeHtml(new Date().toLocaleString())} · ${rows.length} rows</p>
${image}<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></body></html>`;
}

/** A file name from the report's title and today's date. */
export function exportName(title: string, ext: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${slug || "report"}-${new Date().toISOString().slice(0, 10)}.${ext}`;
}
