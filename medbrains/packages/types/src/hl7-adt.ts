/** The HL7 ADT triggers a destination may take. */
export type AdtEvent = "A01" | "A02" | "A03" | "A04" | "A08" | "A11" | "A13";

/** Where one ADT feed goes. */
export interface AdtDestination {
  id: string;
  name: string;
  host: string;
  port: number;
  events: AdtEvent[];
  sending_facility: string | null;
  receiving_application: string;
  receiving_facility: string;
  is_active: boolean;
  updated_at: string;
}

export interface AdtDestinationInput {
  name: string;
  host: string;
  port: number;
  events: AdtEvent[];
  sending_facility?: string;
  receiving_application?: string;
  receiving_facility?: string;
  is_active?: boolean;
}

/** One ADT message as the outbox holds it: trigger and result, no contents. */
export interface AdtDelivery {
  id: string;
  destination: string | null;
  event: AdtEvent | null;
  status: "pending" | "retrying" | "sent" | "failed" | "dlq";
  attempts: number;
  last_error: string | null;
  created_at: string;
  sent_at: string | null;
}
