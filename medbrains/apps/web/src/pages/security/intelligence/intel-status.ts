import type {
  CertInSeverity,
  FindingStatus,
  PostureReport,
  SecurityCheckStatus,
} from "@medbrains/types";
import {
  type Icon,
  IconAlertCircle,
  IconAlertOctagon,
  IconAlertTriangle,
  IconInfoCircle,
} from "@tabler/icons-react";
import type { BadgeTone } from "@/components/ui";

/**
 * Words, tones and staleness for Security → Intelligence. Pure, so the rules
 * that decide "all clear" versus "could not check" are tested on their own:
 * an outage or a silent check must never read as good news.
 */

export interface SeverityView {
  label: string;
  tone: BadgeTone;
  icon: Icon;
}

const SEVERITY: Record<CertInSeverity, SeverityView> = {
  critical: { label: "Critical", tone: "danger", icon: IconAlertOctagon },
  high: { label: "High", tone: "warning", icon: IconAlertTriangle },
  medium: { label: "Medium", tone: "info", icon: IconAlertCircle },
  low: { label: "Low", tone: "neutral", icon: IconInfoCircle },
};

export function severityView(severity: CertInSeverity): SeverityView {
  return SEVERITY[severity];
}

export const SEVERITY_ORDER: readonly CertInSeverity[] = ["critical", "high", "medium", "low"];

export const STATUS_LABEL: Record<FindingStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
  accepted: "Risk accepted",
};

export type CheckState = "ok" | "failed" | "overdue" | "never" | "not_applicable";

export interface CheckView {
  state: CheckState;
  label: string;
  tone: BadgeTone;
  /** When the next run is due; null when it never ran. */
  nextDue: Date | null;
}

/** A check is overdue past twice its interval — the server's watchers use the same rule. */
export function checkView(check: SecurityCheckStatus, now: Date): CheckView {
  const last = check.last;
  if (!last) return { state: "never", label: "Never run", tone: "warning", nextDue: null };
  const started = new Date(last.started_at).getTime();
  const everyMs = check.every_secs * 1000;
  const nextDue = new Date(started + everyMs);
  if (now.getTime() - started > 2 * everyMs) {
    return { state: "overdue", label: "Overdue", tone: "danger", nextDue };
  }
  if (last.outcome === "error") {
    return { state: "failed", label: "Could not run", tone: "danger", nextDue };
  }
  if (last.outcome === "not_applicable") {
    return { state: "not_applicable", label: "Not applicable here", tone: "neutral", nextDue };
  }
  return { state: "ok", label: "Ran", tone: "success", nextDue };
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** "3 h ago", "12 min ago", "2 days ago". */
export function ago(at: string | Date, now: Date): string {
  const ms = Math.max(0, now.getTime() - new Date(at).getTime());
  if (ms < MINUTE) return "just now";
  if (ms < HOUR) return `${Math.floor(ms / MINUTE)} min ago`;
  if (ms < 48 * HOUR) return `${Math.floor(ms / HOUR)} h ago`;
  return `${Math.floor(ms / (24 * HOUR))} days ago`;
}

export type PostureState = "never" | "error" | "stale" | "fresh";

/** Posture runs hourly; older than two hours, its checklist is dated as overdue. */
export function postureState(report: PostureReport | null, now: Date): PostureState {
  if (!report) return "never";
  if (report.outcome === "error") return "error";
  return now.getTime() - new Date(report.started_at).getTime() > 2 * HOUR ? "stale" : "fresh";
}

/**
 * What an empty findings list may say. "Nothing found" only when every check
 * last ran, succeeded and is on schedule; otherwise the emptiness is unproven.
 */
export function emptyFindingsMessage(
  checks: readonly SecurityCheckStatus[],
  now: Date,
): { title: string; description: string; proven: boolean } {
  const unproven = checks.filter((c) => {
    const s = checkView(c, now).state;
    return s === "failed" || s === "overdue" || s === "never";
  });
  if (unproven.length === 0) {
    return {
      title: "Nothing found in the last run",
      description: "Every check ran on schedule and found nothing to act on.",
      proven: true,
    };
  }
  return {
    title: "No findings recorded — but not every check ran",
    description: `${unproven.map((c) => c.label).join(", ")} did not complete. See Checks below.`,
    proven: false,
  };
}
