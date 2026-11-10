/**
 * Counter returns and the business day — mirrors
 * `crates/medbrains-pharmacy/src/pos_returns.rs` + `return_rules.rs` and
 * `crates/medbrains-pharmacy-cash-drawer/src/day_close*.rs`.
 * Money is a decimal string, as the server sends it.
 */

// ── returns ────────────────────────────────────────────────────────────

export interface ReturnWindow {
  sale_date: string;
  today: string;
  window_days: number;
  /** The first day the sale can no longer be returned. */
  locks_on: string;
  locked: boolean;
}

export type LineBlock =
  | { kind: "refused"; message: string }
  | { kind: "needs_controlled_right"; message: string };

export interface TenderBalance {
  mode: string;
  paid: string;
  refunded: string;
}

export interface ReturnableLine {
  item_id: string;
  drug_name: string;
  catalog_item_id: string | null;
  batch_id: string | null;
  batch_number: string | null;
  quantity: number;
  returned_qty: number;
  line_total: string;
  line_gst: string;
  cold_chain: boolean;
  controlled: boolean;
  expired: boolean;
  returnable_qty: number;
  /** Refund for one more unit, GST included. */
  unit_refund: string;
  block: LineBlock | null;
}

export interface Returnable {
  sale_id: string;
  sale_number: string;
  status: string;
  window: ReturnWindow;
  can_override_window: boolean;
  can_take_controlled: boolean;
  lines: ReturnableLine[];
  tenders: TenderBalance[];
}

export interface RefundPart {
  mode: string;
  amount: string;
  reference: string | null;
}

export interface ReturnedLine {
  item_id: string;
  drug_name: string;
  qty: number;
  refund: string;
  gst: string;
  /** `stock` back to its batch, `quarantine` for destruction, `discarded` off-catalogue. */
  destination: "stock" | "quarantine" | "discarded";
  /** Why it was quarantined. */
  reasons: string[];
}

export interface ReturnResult {
  credit_note_id: string;
  credit_note_number: string;
  refund_total: string;
  gst_reversed: string;
  refunds: RefundPart[];
  lines: ReturnedLine[];
  sale_status: string;
  business_date: string;
}

export interface ReturnPosItemsRequest {
  /** `sealed`: the manufacturer's seal is unbroken; unsealed goes to quarantine. */
  items: Array<{ item_id: string; return_qty: number; sealed?: boolean }>;
  reason?: string;
  /** How the money goes back. Absent, in proportion to how it was paid. */
  refund_to?: Array<{ mode: string; amount: string; reference?: string }>;
}

// ── the day close ──────────────────────────────────────────────────────

export interface DrawerLine {
  id: string;
  cashier_name: string | null;
  opened_at: string;
  closed_at: string | null;
  status: string;
  opening_float: string;
  expected_cash: string;
  actual_close_amount: string | null;
}

export interface TenderTotal {
  mode: string;
  collected: string;
  refunded: string;
  net: string;
}

export interface DaySummary {
  sales_count: number;
  sales_total: string;
  discount_total: string;
  gst_total: string;
  returns_count: number;
  returns_total: string;
  petty_cash_total: string;
  expected_cash: string;
  /** Card/UPI sales rung with no drawer open: no counter can claim them. */
  sales_without_drawer: number;
}

export interface ZReport {
  pharmacy_location_id: string;
  business_date: string;
  drawers: DrawerLine[];
  open_drawers: number;
  tenders: TenderTotal[];
  summary: DaySummary;
}

export interface DayCloseRow {
  id: string;
  pharmacy_location_id: string;
  business_date: string;
  status: "closed" | "reopened";
  totals: Record<string, unknown>;
  expected_cash: string;
  counted_cash: string;
  denominations: Record<string, number>;
  variance: string;
  variance_reason: string | null;
  petty_cash_total: string;
  float_carried_forward: string;
  closed_by_name: string | null;
  closed_at: string;
  reopened_by_name: string | null;
  reopened_at: string | null;
  reopen_reason: string | null;
}

export interface DayReport {
  report: ZReport;
  close: DayCloseRow | null;
  /** Why the signed-in user cannot close this day now; `null` means they can. */
  close_refusal: string | null;
}

export interface CounterDay {
  pharmacy_location_id: string;
  location_name: string | null;
  business_date: string;
  drawers: number;
  open_drawers: number;
  close_id: string | null;
  status: "open" | "closed" | "reopened";
  variance: string | null;
  closed_by_name: string | null;
  closed_at: string | null;
}

export interface CloseDayRequest {
  pharmacy_location_id: string;
  business_date: string;
  /** Pieces counted per denomination, e.g. `{ "500": 3, "100": 7 }`. */
  denominations: Record<string, number>;
  variance_reason?: string;
  float_carried_forward?: number;
}
