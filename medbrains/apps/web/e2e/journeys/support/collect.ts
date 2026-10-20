/**
 * Collect anywhere (#4885): starting data for the Collect drawer journeys —
 * bills from named departments, made through the API — and the database
 * reads that prove what a collection saved.
 *
 * DB asserts read the server's own database: set `E2E_DATABASE_URL` to the
 * database the server under test uses.
 */
import { execFileSync } from "node:child_process";
import type { Locator, Page } from "@playwright/test";
import axe from "axe-core";
import { type AuthContext, api } from "../../helpers/api";
import { expect } from "./world";

const DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? "postgres://medbrains:medbrains_dev@localhost:5435/medbrains";

/** Rows of one SQL query, each a `|`-joined line. Read-only use, starting data only. */
export function db(sql: string): string[] {
  const out = execFileSync("psql", [DATABASE_URL, "-tAc", sql], { encoding: "utf8" });
  return out.split("\n").filter((line) => line.trim() !== "");
}

/** A bill for the patient with one `source` line of `total` rupees, issued unless asked not to. */
export async function billOf(
  admin: AuthContext,
  patientId: string,
  source: string,
  total: number,
  issue = true,
): Promise<string> {
  const invoice = await api<{ id: string }>(admin, "POST", "/api/billing/invoices", {
    patient_id: patientId,
  });
  await api(admin, "POST", `/api/billing/invoices/${invoice.id}/items`, {
    charge_code: `T-${source.toUpperCase()}`,
    description: `${source} charge`,
    source,
    quantity: 1,
    unit_price: total,
    tax_percent: 0,
  });
  if (issue) await api(admin, "POST", `/api/billing/invoices/${invoice.id}/issue`);
  return invoice.id;
}

/** The desk may see this patient: the care grant the desk that serves them holds. */
export function grantView(userId: string, patientId: string): void {
  db(
    `INSERT INTO relation_tuples (tuple_id, tenant_id, object_type, object_id, relation, subject_type, subject_id, granted_by, granted_reason, source)
     SELECT gen_random_uuid(), p.tenant_id, 'patient', p.id, 'viewer', 'user', '${userId}', u.id, 'e2e collect', 'explicit'
       FROM patients p, users u WHERE p.id = '${patientId}' AND u.username = 'admin' AND u.tenant_id = p.tenant_id`,
  );
}

/** What the server saved for a bill: status and paid. */
export function savedInvoice(invoiceId: string): { status: string; paid: number } {
  const [row] = db(`SELECT status, paid_amount FROM invoices WHERE id = '${invoiceId}'`);
  const [status = "", paid = "0"] = (row ?? "").split("|");
  return { status, paid: Number(paid) };
}

/** The collections taken for a patient: scope, lane, total, tender modes. */
export function collectionsOf(patientId: string) {
  return db(
    `SELECT c.id, c.scope, coalesce(c.lane, ''), c.total_amount,
            (SELECT string_agg(p.mode::text || ':' || p.amount, ',' ORDER BY p.mode::text, p.amount)
               FROM payments p WHERE p.collection_id = c.id AND p.deleted_at IS NULL)
       FROM collections c WHERE c.patient_id = '${patientId}' ORDER BY c.created_at`,
  ).map((row) => {
    const [id = "", scope = "", lane = "", total = "0", payments = ""] = row.split("|");
    return { id, scope, lane, total: Number(total), payments };
  });
}

/** Receipts of a collection, by legal entity. */
export function receiptsOf(collectionId: string) {
  return db(
    `SELECT receipt_number, coalesce(legal_entity_id::text, ''), amount FROM receipts
      WHERE collection_id = '${collectionId}' AND deleted_at IS NULL ORDER BY receipt_number`,
  ).map((row) => {
    const [number = "", entity = "", amount = "0"] = row.split("|");
    return { number, entity, amount: Number(amount) };
  });
}

/** A billing entity of the test's own (a separately registered pharmacy). */
export async function pharmacyEntity(admin: AuthContext): Promise<string> {
  const tag = crypto.randomUUID().slice(0, 6).toUpperCase();
  const entity = await api<{ id: string }>(admin, "POST", "/api/billing/entities", {
    code: `PH-${tag}`,
    name: `Pharmacy ${tag}`,
    receipt_prefix: `P${tag}`,
    drug_licence: "TN-DL-0001",
  });
  return entity.id;
}

export function billUnderEntity(invoiceId: string, entityId: string): void {
  db(`UPDATE invoices SET legal_entity_id = '${entityId}' WHERE id = '${invoiceId}'`);
}

/** The Collect drawer. */
export function collectDrawer(page: Page): Locator {
  return page.getByRole("dialog", { name: "Collect payment" });
}

/** axe WCAG 2.2 AA on the drawer itself (it renders outside `main`). */
export async function expectDrawerAccessible(page: Page): Promise<void> {
  await page.addScriptTag({ content: axe.source });
  const violations = await page.evaluate(async () => {
    const root = document.querySelector('[role="dialog"]');
    if (!root) return [{ id: "no-dialog", nodes: [] }];
    const result = await (window as unknown as { axe: typeof axe }).axe.run(root, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] },
      resultTypes: ["violations"],
    });
    return result.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.slice(0, 3).map((n) => n.target.join(" ")),
    }));
  });
  expect(violations, `Collect drawer: WCAG 2.2 AA\n${JSON.stringify(violations, null, 2)}`).toEqual(
    [],
  );
}

/** Where a journey's screenshots go. */
export function shotPath(name: string): string {
  const dir = process.env.COLLECT_SHOTS_DIR ?? "test-results/collect-shots";
  return `${dir}/${name}.png`;
}
