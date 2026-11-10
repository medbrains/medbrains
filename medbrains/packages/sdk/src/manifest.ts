/**
 * The extension manifest (docs/extensions/manifest.schema.json) and the same
 * checks the server runs at registration, so `medbrains ext validate` fails
 * where the hospital would. One rule is server-only: whether an event name is
 * one this MedBrains version sends (`medbrains ext test --url` checks it).
 */

export const MANIFEST_VERSION = 1;
export const KINDS = ["service", "smart-app", "mcp-tool", "wasm-block"] as const;
export const DATA_CLASSES = [
  "routine",
  "sensitive",
  "identifying",
  "restricted",
  "confidential",
  "sealed",
] as const;
/** Each readable FHIR resource and the permission that must back it. */
export const READS: Record<string, string> = {
  Patient: "patients.view",
  Encounter: "opd.queue.view",
  Observation: "lab.orders.view",
};

export interface Manifest {
  manifestVersion: 1;
  kind: (typeof KINDS)[number];
  name: string;
  purpose: string;
  publisher: { name: string; url?: string; contact?: string };
  version: string;
  permissions: string[];
  reads?: string[];
  events?: string[];
  dataClasses: string[];
  sendsDataTo?: { name: string; url: string; purpose: string }[];
  webhookUrl?: string;
  redirectUris?: string[];
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
}

const FIELDS = new Set([
  "manifestVersion",
  "kind",
  "name",
  "purpose",
  "publisher",
  "version",
  "permissions",
  "reads",
  "events",
  "dataClasses",
  "sendsDataTo",
  "webhookUrl",
  "redirectUris",
  "inputSchema",
  "outputSchema",
]);
const REQUIRED = [
  "manifestVersion",
  "kind",
  "name",
  "purpose",
  "publisher",
  "version",
  "permissions",
  "dataClasses",
];
const PERMISSION = /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/;
const SEMVER = /^[0-9]+\.[0-9]+\.[0-9]+([-+].*)?$/;
const isHttps = (u: unknown) => typeof u === "string" && /^https:\/\/\S+$/.test(u);
const list = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);

/** Every problem at once, in the server's words. Empty means valid. */
export function validateManifest(raw: unknown): string[] {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw))
    return ["the manifest must be a JSON object"];
  const m = raw as Record<string, unknown>;
  const errors: string[] = [];
  for (const key of Object.keys(m)) if (!FIELDS.has(key)) errors.push(`unknown field \`${key}\``);
  for (const key of REQUIRED) if (!(key in m)) errors.push(`missing field \`${key}\``);
  if (errors.length) return errors;

  const text = (field: string, v: unknown, max: number) => {
    const len = typeof v === "string" ? [...v.trim()].length : 0;
    if (len === 0 || len > max) errors.push(`${field} must be 1–${max} characters`);
  };
  const unique = (field: string, v: string[]) => {
    if (new Set(v).size !== v.length) errors.push(`${field} lists something twice`);
  };

  if (m.manifestVersion !== MANIFEST_VERSION)
    errors.push(`manifestVersion must be ${MANIFEST_VERSION}`);
  if (!KINDS.includes(m.kind as never)) errors.push(`kind must be one of ${KINDS.join(", ")}`);
  text("name", m.name, 80);
  text("purpose", m.purpose, 200);
  if (String(m.purpose).includes("\n")) errors.push("purpose must be one sentence");
  const publisher = (m.publisher ?? {}) as Record<string, unknown>;
  text("publisher.name", publisher.name, 120);
  if (publisher.url !== undefined && !isHttps(publisher.url))
    errors.push("publisher.url must be https");
  if (!SEMVER.test(String(m.version))) errors.push("version must be semantic, like 1.2.0");

  const permissions = list(m.permissions);
  if (permissions.length < 1 || permissions.length > 50)
    errors.push("permissions must list 1–50 codes");
  unique("permissions", permissions);
  for (const p of permissions) {
    if (!PERMISSION.test(p)) errors.push(`'${p}' is not a permission code (like patients.view)`);
  }

  const reads = list(m.reads);
  unique("reads", reads);
  for (const r of reads) {
    const needs = READS[r];
    if (!needs)
      errors.push(`reads: '${r}' is not readable in protocol v1 (Patient, Encounter, Observation)`);
    else if (!permissions.includes(needs)) errors.push(`reads ${r} needs the permission ${needs}`);
  }

  const events = list(m.events);
  unique("events", events);
  if (events.length && m.webhookUrl === undefined)
    errors.push("events need a webhookUrl to deliver them to");
  if (m.webhookUrl !== undefined && !isHttps(m.webhookUrl)) errors.push("webhookUrl must be https");

  const classes = list(m.dataClasses);
  if (!classes.length) errors.push("dataClasses must name at least one class");
  unique("dataClasses", classes);
  for (const c of classes) {
    if (!DATA_CLASSES.includes(c as never)) {
      errors.push(`dataClasses: '${c}' must be one of ${DATA_CLASSES.join(", ")}`);
    }
  }

  const sends = Array.isArray(m.sendsDataTo) ? (m.sendsDataTo as Record<string, unknown>[]) : [];
  if ((reads.length || events.length) && !sends.length) {
    errors.push("sendsDataTo must say where the data it reads goes");
  }
  const redirects = list(m.redirectUris);
  if (sends.length > 20 || redirects.length > 20 || events.length > 100) {
    errors.push("lists are capped (sendsDataTo and redirectUris at 20)");
  }
  sends.forEach((d, i) => {
    text(`sendsDataTo[${i}].name`, d.name, 120);
    text(`sendsDataTo[${i}].purpose`, d.purpose, 200);
    if (!isHttps(d.url)) errors.push(`sendsDataTo[${i}].url must be https`);
  });
  for (const u of redirects) if (!isHttps(u)) errors.push(`redirect URI '${u}' must be https`);
  for (const field of ["inputSchema", "outputSchema"]) {
    const v = m[field];
    if (v !== undefined && (typeof v !== "object" || v === null || Array.isArray(v))) {
      errors.push(`${field} must be a JSON Schema object`);
    }
  }
  return errors;
}
