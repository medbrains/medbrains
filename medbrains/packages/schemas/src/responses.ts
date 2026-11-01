/**
 * Runtime shapes of the responses where drift does harm: money (billing),
 * results (lab) and quantities (pharmacy). Loose objects — a field the server
 * adds is not drift — but every field a screen reads to charge, dispense or
 * report is checked, so a decimal turning into a float or a quantity into a
 * string fails loudly instead of rendering a wrong number.
 */
import { z } from "zod";

const id = z.uuid();
/** rust_decimal serialises as a string; a JS number here would lose paise. */
const decimal = z.string().regex(/^-?\d+(\.\d+)?$/, "expected a decimal string");
const count = z.number().int();

const invoice = z.looseObject({
  id,
  invoice_number: z.string(),
  patient_id: id,
  status: z.string(),
  subtotal: decimal,
  tax_amount: decimal,
  discount_amount: decimal,
  total_amount: decimal,
  paid_amount: decimal,
  cgst_amount: decimal,
  sgst_amount: decimal,
  igst_amount: decimal,
  cess_amount: decimal,
});
const invoiceItem = z.looseObject({
  id,
  invoice_id: id,
  description: z.string(),
  quantity: count,
  unit_price: decimal,
  tax_percent: decimal,
  total_price: decimal,
  cgst_amount: decimal,
  sgst_amount: decimal,
  igst_amount: decimal,
});
const payment = z.looseObject({ id, invoice_id: id, amount: decimal, mode: z.string() });

export const invoiceListResponseSchema = z.looseObject({
  invoices: z.array(invoice),
  total: count,
});
export const invoiceDetailResponseSchema = z.looseObject({
  invoice,
  items: z.array(invoiceItem),
  payments: z.array(payment),
});
export const paymentListResponseSchema = z.array(payment);

const labOrder = z.looseObject({
  id,
  patient_id: id,
  test_id: id,
  status: z.string(),
  priority: z.string(),
  is_stat: z.boolean(),
});
const labResult = z.looseObject({
  id,
  order_id: id,
  parameter_name: z.string(),
  value: z.string(),
  unit: z.string().nullable(),
  normal_range: z.string().nullable(),
  flag: z.string().nullable(),
  is_delta_flagged: z.boolean(),
});

export const labOrderListResponseSchema = z.looseObject({
  orders: z.array(labOrder),
  patients: z.array(z.looseObject({ id })),
  total: count,
});
export const labOrderDetailResponseSchema = z.looseObject({
  order: labOrder,
  results: z.array(labResult),
});
export const labResultListResponseSchema = z.array(labResult);

const pharmacyOrder = z.looseObject({
  id,
  patient_id: id.nullable(),
  status: z.string(),
  dispensing_type: z.string(),
});
const pharmacyOrderItem = z.looseObject({
  id,
  order_id: id,
  drug_name: z.string(),
  quantity: count,
  unit_price: decimal,
  total_price: decimal,
  quantity_dispensed: count,
  quantity_returned: count,
  expiry_date: z.string().nullable(),
});

export const pharmacyOrderListResponseSchema = z.looseObject({
  orders: z.array(pharmacyOrder),
  total: count,
});
export const pharmacyOrderDetailResponseSchema = z.looseObject({
  order: pharmacyOrder,
  items: z.array(pharmacyOrderItem),
});

// Knowledge change sets: the impact a reviewer approves against, and the
// status that decides which action is offered, must not drift silently.
const knowledgeStatus = z.enum([
  "draft",
  "previewed",
  "approved",
  "applied",
  "rolled_back",
  "rejected",
  "stale",
]);
const knowledgeImpact = z.looseObject({
  entries: z.array(
    z.looseObject({
      severity: z.enum(["safety", "access", "money", "info"]),
      relation: z.string(),
      summary: z.string(),
      count: count,
      examples: z.array(z.looseObject({ label: z.string(), href: z.string().nullable() })),
      truncated: z.boolean(),
    }),
  ),
  computed_at: z.string(),
});
const knowledgeChangeSet = z.looseObject({
  id,
  area: z.enum(["drug_interactions", "critical_value_rules"]),
  title: z.string(),
  status: knowledgeStatus,
  author_id: id,
  approver_id: id.nullable(),
  impact: knowledgeImpact.nullable(),
});
const knowledgeRow = z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]));
export const knowledgeChangeSetListResponseSchema = z.array(knowledgeChangeSet);
export const knowledgeChangeSetDetailResponseSchema = knowledgeChangeSet.extend({
  items: z.array(
    z.looseObject({
      id,
      op: z.enum(["create", "update", "delete"]),
      target_key: z.string().nullable(),
      before: knowledgeRow.nullable(),
      after: knowledgeRow.nullable(),
      seq: count,
    }),
  ),
});
export const knowledgeLiveRowsResponseSchema = z.array(z.looseObject({ id, fields: knowledgeRow }));
export const knowledgeProofResponseSchema = z.looseObject({
  change_set_id: id,
  canonical: z.string(),
  proof_hash: z.string().regex(/^[0-9a-f]{64}$/),
  audit_rows: z.array(z.looseObject({ id, action: z.string(), hash: z.string() })),
});

/**
 * Where `data` departs from `schema`, as one line naming each field and the
 * problem — never the values, which are patient data. Null when it conforms.
 */
export function describeShapeDrift(schema: z.ZodType, data: unknown): string | null {
  const result = schema.safeParse(data);
  if (result.success) return null;
  return result.error.issues
    .slice(0, 5)
    .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("; ");
}
