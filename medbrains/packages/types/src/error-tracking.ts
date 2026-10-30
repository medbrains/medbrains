/** What the browser needs to start error tracking (`GET /public/error-tracking/config`). */
export interface ErrorTrackingClientConfig {
  enabled: boolean;
  dsn: string | null;
  environment: string | null;
  /** Same-origin path the browser SDK posts its envelopes to. */
  tunnel: string;
}

export interface ErrorTrackingRecentIssue {
  short_id: string;
  title: string;
  level: string | null;
  event_count: number;
  last_seen: string;
}

export interface ErrorTrackingSnapshot {
  status: "available";
  release: string;
  environment: string;
  new_issues_24h: number;
  events_24h: number;
  open_issues: number;
  sessions_24h: number;
  /** 0–1; null while the release has no sessions yet. */
  crash_free_rate: number | null;
  recent_issues: ErrorTrackingRecentIssue[];
  dashboard_url: string | null;
}

/**
 * The admin summary (`GET /admin/error-tracking/summary`). Three outcomes:
 * not configured, the tracker did not answer, or the numbers.
 */
export type ErrorTrackingSummary =
  | { status: "off"; reason: string }
  | { status: "unavailable"; reason: string; dashboard_url: string | null }
  | ErrorTrackingSnapshot;
