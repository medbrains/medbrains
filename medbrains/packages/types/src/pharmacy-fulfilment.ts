/**
 * Pharmacy fulfilment — the life of an order between payment and collection.
 *
 * Only meaningful for a store set to `pack_and_collect`. A pharmacy that hands
 * medicine across the same counter that took the money goes straight from
 * `ordered` to `dispensed` and never touches any of this.
 */

/** Where an order is. Mirrors the CHECK on `pharmacy_orders.status`. */
export type FulfilmentStage =
  | "ordered"
  | "picking"
  | "packed"
  | "verified"
  | "ready"
  | "collected"
  | "released"
  | "dispensed"
  | "partially_dispensed"
  | "cancelled"
  | "returned";

/** How a store hands medicine over. */
export type FulfilmentMode = "direct" | "pack_and_collect";

/** A row in the picking queue. */
export interface FulfilmentQueueRow {
  id: string;
  status: FulfilmentStage;
  patient_id: string;
  /** Checked against what the patient says before the bag changes hands. */
  patient_name: string | null;
  uhid: string | null;
  store_location_id: string | null;
  created_at: string;
  line_count: number;
  /** Lines still to be checked against the order. Zero is the gate to `ready`. */
  unverified_lines: number;
  /**
   * Lines whose committed batch expires within 90 days. Any order holding one
   * floats to the top of the queue — short-dated stock only exists if somebody
   * dispenses it.
   */
  near_expiry_lines: number;
  /**
   * Earliest moment a batch committed to this order entered inventory. Second
   * queue priority: among orders equally exposed to expiry, the one carrying
   * the longest-resident stock is served first (FIFO on receipt).
   */
  oldest_batch_received_at: string | null;
  token_number: string | null;
}

/**
 * One line to walk to and take.
 *
 * The batch is named, not just the drug: the batch was chosen when the stock
 * was committed, and a pick list that gave only a drug name would invite
 * whoever is holding it to take the nearest box.
 */
export interface PickLine {
  order_item_id: string;
  drug_name: string;
  quantity: number;
  batch_number: string | null;
  expiry_date: string | null;
  rack: string | null;
  shelf: string | null;
  bin: string | null;
  verified_at: string | null;
}

export interface FulfilmentStageResponse {
  id: string;
  status: FulfilmentStage;
}

/**
 * Check one line against the order.
 *
 * Send `scanned_code` when the pack was scanned; the server resolves it against
 * the catalogue and refuses if it is the wrong drug. Send `note` instead when
 * the line was checked by eye — one or the other is required, and the reason is
 * kept, because a pharmacy that is ticking everything manually has learned
 * something about its barcodes.
 */
export interface VerifyLineRequest {
  order_item_id: string;
  scanned_code?: string;
  note?: string;
}

export interface VerifyLineResponse {
  order_item_id: string;
  method: "scan" | "manual";
  outstanding_lines: number;
}

export interface ReleaseOrderRequest {
  reason: string;
}

/**
 * Pull an in-flight order out of the flow.
 *
 * Released means we finished and nobody came; cancelled means we stopped.
 * Either way the stock goes back to the batches it came from, and the reason
 * is kept because both leave a money question open.
 */
export interface CancelOrderRequest {
  reason: string;
}
