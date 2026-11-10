/** Health intelligence (RFC-OSINT §4): `GET /api/health-intel`. Aggregate only. */

export type SignalLevel = "usual" | "higher" | "much_higher";
export type BaselineMethod = "same_weeks_previous_years" | "rolling_8_weeks" | "not_enough_history";

/** One condition's last 7 days against the hospital's own usual. */
export interface ConditionSignal {
  condition: string;
  /** Null means 1–4 cases: small counts are suppressed ("fewer than 5"). */
  this_week: number | null;
  /** The usual weekly count, rounded; null when 1–4 or no history. */
  usual: number | null;
  method: BaselineMethod;
  level: SignalLevel;
  /** Weekly counts, oldest first; null for a suppressed week. */
  series: (number | null)[];
}

/** A public outbreak notice: title, source, date and link (never full text). */
export interface HealthNotice {
  id: string;
  source: string;
  title: string;
  summary: string | null;
  url: string;
  published_at: string | null;
  conditions: string[];
  regions: string[];
  /** Mentions the hospital's state or India. */
  is_local: boolean;
}

export interface Advisory {
  /** Heat: none | heat_caution | heat_wave | severe_heat_wave. Air: the CPCB band. */
  level: string;
  is_advisory: boolean;
}

/** Weather and air quality, fetched by the server for the hospital's location. */
export interface EnvironmentView {
  status: "current" | "not_available" | "off";
  /** When the shown reading was taken; only when status is current. */
  as_of: string | null;
  last_attempt_at: string | null;
  last_good_at: string | null;
  reason: string | null;
  temperature_c: number | null;
  weather_code: number | null;
  forecast_max_c: number | null;
  forecast_max_on: string | null;
  pm2_5: number | null;
  pm10: number | null;
  heat: Advisory | null;
  air: Advisory | null;
}

/** A scheduled job or public feed, and whether it is still running. */
export interface CheckStatus {
  name: string;
  kind: "job" | "feed";
  label: string;
  state: "running" | "failing" | "stopped" | "never_run";
  last_ok_at: string | null;
  last_attempt_at: string | null;
  last_error: string | null;
}

export interface HealthIntel {
  conditions: ConditionSignal[];
  computed_at: string | null;
  region: string | null;
  notices: HealthNotice[];
  environment: EnvironmentView;
  checks: CheckStatus[];
}
