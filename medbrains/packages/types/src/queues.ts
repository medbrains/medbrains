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
  reset_rule: "daily" | "session" | "never";
  max_tokens_per_period: number | null;
  lifecycle: "permanent" | "temporary";
  valid_from: string | null;
  valid_until: string | null;
  status: "active" | "paused" | "closed";
  /** How long before a session opens its tokens are given out. */
  early_issue_minutes: number;
}

/** A queue as Admin → Queues lists it, with tokens issued this period. */
export interface QueueRow extends QueueConfig {
  issued: number;
  /** Why the queue takes no token right now, e.g. "closed — tokens from 15:00". */
  closed_reason: string | null;
}

/**
 * When a queue gives out tokens. A queue with no sessions gives them out all
 * day; sessions govern issuing only, never the patients already waiting.
 */
export interface QueueSession {
  label: string;
  /** ISO weekdays, 1 = Monday .. 7 = Sunday; empty means every day. */
  days: number[];
  /** "HH:MM:SS", the hospital's local time. */
  opens: string;
  closes: string;
  /** Replaces the queue's prefix during this session. */
  prefix: string | null;
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

/** A counter (a station) serving a queue, and who may call there. */
export interface QueueCounter {
  station_id: string;
  name: string;
  /** Empty: anyone who may work the queue calls here. */
  staff_user_ids: string[];
  staff_names: string[];
}

export interface QueueCounterInput {
  station_id: string;
  staff_user_ids: string[];
}
