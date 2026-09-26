/** One message the system would have sent, captured by the message simulator. */
export interface SimulatedMessage {
  id: string;
  channel: "sms" | "whatsapp" | "email";
  recipient: string;
  event_type: string;
  subject: string | null;
  body: string;
  attachments: Array<{ filename?: string; object_key?: string; mime?: string }>;
  template_id: string | null;
  created_at: string;
}

/** Everything sent to one person, and the numbers/addresses that identify them. */
export interface SimulatorInbox {
  recipients: string[];
  messages: SimulatedMessage[];
}

export interface SimulatorInboxQuery {
  patient_id?: string;
  user_id?: string;
  recipient?: string;
}
