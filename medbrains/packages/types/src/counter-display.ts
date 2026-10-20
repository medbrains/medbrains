/**
 * The customer display at a billing or pharmacy counter (#4883). Mirrors
 * `crates/medbrains-device-pairing/src/counter_display.rs`. Amounts are paise.
 */

export type CounterDisplayPhase = "idle" | "session" | "qr" | "card" | "paid";

export type CounterDisplayTender =
  | "cash"
  | "card"
  | "upi"
  | "online"
  | "advance"
  | "credit"
  | "link";

export type CounterCardStatus = "waiting" | "approved" | "declined" | "timed_out" | "cancelled";

export interface CounterDisplayLine {
  label: string;
  amount_paise: number;
}

/** Everything a display may show; nothing else about the patient exists in it. */
export interface CounterDisplayState {
  seq: number;
  session: string | null;
  phase: CounterDisplayPhase;
  /** First name and initial only, cut by the server. */
  patient: string | null;
  lines: CounterDisplayLine[];
  total_due_paise: number;
  tender: CounterDisplayTender | null;
  amount_paise: number;
  qr: { upi_uri: string | null; image_url: string | null; close_by: number | null } | null;
  card_status: CounterCardStatus | null;
  change_paise: number | null;
}

/** One change in the cashier's drawer. */
export type CounterDisplayEvent =
  | { type: "session_start"; session: string; patient_name?: string }
  | { type: "items"; session: string; lines: CounterDisplayLine[]; total_due_paise: number }
  | {
      type: "tender_selected";
      session: string;
      tender: CounterDisplayTender;
      amount_paise: number;
    }
  | {
      type: "qr_shown";
      session: string;
      amount_paise: number;
      upi_uri?: string | null;
      image_url?: string | null;
      close_by?: number | null;
    }
  | { type: "card_status"; session: string; status: CounterCardStatus; amount_paise: number }
  | { type: "paid"; session: string; amount_paise: number; change_paise?: number }
  | { type: "cleared"; session: string };

/** What a paired customer display reads about itself. */
export interface CounterDisplayView {
  label: string;
  station_id: string;
  station_name: string;
  station_type: string;
  hospital_name: string;
  logo_url: string | null;
  state: CounterDisplayState;
}

export interface CounterDisplayAck {
  seq: number;
  connected: boolean;
}

export interface CounterDisplayStatus {
  /** A live display is paired to this counter. */
  paired: boolean;
  /** One is reading it now. */
  connected: boolean;
}
