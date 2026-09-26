/** A configured queue: how one module's queue at one place numbers and admits tokens. */
export interface QueueConfig {
  id: string;
  name: string;
  module: string;
  scope: string;
  scope_id: string | null;
  scope_label: string | null;
  prefix: string;
  start_at: number;
  pad_width: number;
  reset_rule: "daily" | "never";
  max_tokens_per_period: number | null;
  lifecycle: "permanent" | "temporary";
  valid_from: string | null;
  valid_until: string | null;
  status: "active" | "paused" | "closed";
}

/** A queue as Admin → Queues lists it, with tokens issued this period. */
export interface QueueRow extends QueueConfig {
  issued: number;
}

/** A department, room, counter or station a queue can serve. */
export interface QueuePlace {
  scope: string;
  scope_id: string;
  label: string;
  kind: string | null;
}

export type QueueInput = Omit<QueueConfig, "id" | "scope_label">;

/**
 * A priority lane a queue offers. Stat, urgent and emergency referral are not
 * configurable — they are always called first, in every queue.
 */
export interface QueueCategory {
  code: string;
  label: string;
  /** 3 (called first) to 9 (called last). */
  rank: number;
  kiosk_selectable: boolean;
  is_active: boolean;
}
