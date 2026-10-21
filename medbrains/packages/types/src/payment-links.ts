/** Balance payment links (#4871): a link for all or part of what a patient owes. */

export type PaymentLinkStatus =
  | "pending"
  | "created"
  | "partially_paid"
  | "paid"
  | "expired"
  | "cancelled"
  | "failed";

export type PaymentLinkChannel = "sms" | "whatsapp" | "copy" | "portal";

export interface PaymentLinkView {
  id: string;
  patient_id: string;
  invoice_ids: string[];
  scope: string;
  lane: string | null;
  amount: string;
  amount_paid: string;
  accept_partial: boolean;
  min_part_amount: string | null;
  /** Reads `expired` once the expiry has passed. */
  status: PaymentLinkStatus;
  provider: string;
  short_url: string | null;
  expires_at: string;
  channel: PaymentLinkChannel;
  sent_count: number;
  last_sent_at: string | null;
  replaces_id: string | null;
  /** Why it stopped: `replaced`, `settled`, `cancelled_by_staff`… */
  end_reason: string | null;
  error: string | null;
  created_at: string;
}

export interface CreateLinkRequest {
  patient_id: string;
  scope: "department" | "all";
  lane?: string;
  invoice_ids?: string[];
  /** A part of the due; everything due when absent. */
  amount?: number;
  channel: "sms" | "whatsapp" | "copy";
  station_id?: string;
  expiry_days?: number;
}

export interface ResendLinkRequest {
  channel: "sms" | "whatsapp" | "copy";
  station_id?: string;
}

export interface PortalPayRequest {
  amount?: number;
}

/** `tenant_settings` payments/balance_link. */
export interface PaymentLinkSettings {
  accept_partial: boolean;
  min_part_amount: number;
  expiry_days: number;
  reminders: boolean;
}
