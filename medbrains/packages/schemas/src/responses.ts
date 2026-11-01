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
  area: z.enum(["drug_interactions", "critical_value_rules", "flow_switches"]),
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

// SOP flows: the switchboard, map, control room and ticket decide routes and
// patient-safety holds from these shapes, so they must not drift silently.
const flowSwitchValue = z.union([z.boolean(), z.string()]);
const flowClause = z.record(z.string(), flowSwitchValue).nullable();
const flowStation = z.looseObject({
  key: z.string(),
  name: z.string(),
  stage: z.string(),
  kind: z.looseObject({ type: z.enum(["action", "task", "switch", "signal", "end"]) }),
  lane: z.string().nullable(),
  switch_when: flowClause,
  fact_when: flowClause,
  sla_minutes: count.nullable(),
  locked: z.boolean(),
  holder: z.string(),
  path: z.string(),
});
const flowSwitchDef = z.looseObject({
  key: z.string(),
  stage: z.string(),
  sentence: z.string(),
  kind: z.looseObject({ type: z.enum(["on_off", "choice"]) }),
  effects: z.array(z.looseObject({ value: z.string(), label: z.string() })),
  path: z.string(),
});
export const flowListResponseSchema = z.array(
  z.looseObject({ code: z.string(), name: z.string(), in_flight: count }),
);
export const flowDetailResponseSchema = z.looseObject({
  code: z.string(),
  template_id: id,
  version: count,
  switches: z.record(z.string(), flowSwitchValue),
  switch_defs: z.array(flowSwitchDef),
  stations: z.array(flowStation),
  in_flight: z.array(z.looseObject({ version: count, patients: count })),
  pending_change: z.looseObject({ id, status: knowledgeStatus, approvals: count }).nullable(),
  history: z.array(z.looseObject({ change_set_id: id, title: z.string() })),
  path: z.string(),
});
export const flowImpactResponseSchema = z.looseObject({
  route_changes: z.array(z.string()),
  entries: z.array(
    z.looseObject({
      severity: z.enum(["safety", "money", "info"]),
      summary: z.string(),
      count: count,
      examples: z.array(z.looseObject({ label: z.string(), href: z.string().nullable() })),
    }),
  ),
});
export const flowControlRoomResponseSchema = z.looseObject({
  flow_code: z.string(),
  patients_visible: z.boolean(),
  spotlight: z.string(),
  stations: z.array(
    z.looseObject({
      key: z.string(),
      count: count,
      longest_minutes: count.nullable(),
      label: z.enum(["calm", "busy", "overdue"]),
      patients: z.array(z.looseObject({ admission_id: id, minutes: count, overdue: z.boolean() })),
    }),
  ),
});
const flowTicket = z.looseObject({
  instance_id: id,
  version: count,
  status: z.string(),
  current: z
    .looseObject({
      key: z.string(),
      kind: z.enum(["action", "task", "switch", "signal", "end"]),
      outstanding: z.array(z.string()),
      minutes: count,
      overdue: z.boolean(),
    })
    .nullable(),
  stops: z.array(
    z.looseObject({ key: z.string(), state: z.enum(["done", "current", "ahead", "skipped"]) }),
  ),
});
export const flowTicketResponseSchema = flowTicket;
export const flowTicketOrNullResponseSchema = flowTicket.nullable();

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
