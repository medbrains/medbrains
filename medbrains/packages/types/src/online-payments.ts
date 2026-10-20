/** Online payments over any provider (#4884): what a counter's provider can do, and its setup. */

/** What a provider can do through MedBrains; a screen offers only what is `true`. */
export interface PaymentCapabilities {
  checkout: boolean;
  dynamic_qr: boolean;
  payment_links: boolean;
  partial_refund: boolean;
  multiple_refunds: boolean;
  payouts: boolean;
  upi_collect: boolean;
  emi: boolean;
}

export interface OnlineProviderView {
  provider: string;
  label: string;
  /** Its keys are set (no secret is ever returned). */
  configured: boolean;
  /** `test` or `live` keys. */
  mode: string | null;
  capabilities: PaymentCapabilities;
}

/** `GET /api/payments/capabilities`: the counter's provider and the hospital's fallback. */
export interface CapabilitiesView {
  /** `null` when the hospital's provider has no MedBrains adapter. */
  active: OnlineProviderView | null;
  station_override: boolean;
  fallback: OnlineProviderView | null;
}

export interface ProviderKeyField {
  name: string;
  label: string;
  secret: boolean;
  required: boolean;
  set: boolean;
  /** Shown only for a field that is not secret. */
  value: string | null;
}

export interface ProviderSetup {
  provider: string;
  label: string;
  capabilities: PaymentCapabilities;
  configured: boolean;
  missing: string[];
  mode: string | null;
  source: string | null;
  fields: ProviderKeyField[];
  /** Calls go to a stand-in (tests and rehearsals). */
  stand_in: boolean;
}

export interface StationProvider {
  id: string;
  name: string;
  code: string;
  station_type: string;
  payment_provider: string | null;
}

export interface OnlineSettings {
  active_provider: string;
  fallback_provider: string | null;
  providers: ProviderSetup[];
  stations: StationProvider[];
}

export interface ChooseProviders {
  active_provider: string;
  fallback_provider: string | null;
}

export interface SetKeys {
  /** Only the fields being changed; an empty value leaves a field as it is. */
  values: Record<string, string>;
  mode?: "test" | "live";
}

export interface StationChoice {
  payment_provider: string | null;
}

export interface ProviderTestResult {
  ok: boolean;
  message: string;
}
