// Shared starting data for the Collect drawer's tests.
import type { DueBill } from "@medbrains/types";

export function bill(id: string, over: Partial<DueBill> = {}): DueBill {
  return {
    invoice_id: id,
    invoice_number: `INV-${id}`,
    status: "issued",
    legal_entity_id: null,
    entity_name: null,
    bill_group_id: null,
    encounter_id: null,
    admission_id: null,
    total_amount: "100.00",
    paid_amount: "0.00",
    balance: "100.00",
    lanes: ["lab"],
    can_collect: true,
    ...over,
  };
}
