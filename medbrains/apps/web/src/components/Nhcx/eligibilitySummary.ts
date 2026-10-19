import type { NhcxEligibilityCheck, PreauthSla } from "@medbrains/types";
import type { BadgeTone } from "@/components/ui";

export interface EligibilitySummary {
  label: string;
  tone: BadgeTone;
  /** True while the payer's answer is still to come. */
  isWaiting: boolean;
}

/**
 * Where an NHCX eligibility check stands, in the desk's words. A check that
 * has not been answered is "waiting" — never "not covered".
 */
export function summariseEligibility(check: NhcxEligibilityCheck | undefined): EligibilitySummary {
  if (!check) return { label: "Not checked through NHCX yet", tone: "neutral", isWaiting: false };
  if (check.nhcx_status === "send_failed") {
    return { label: "Not sent — the payer could not be reached", tone: "danger", isWaiting: false };
  }
  switch (check.status) {
    case "active":
      return { label: "Policy in force", tone: "success", isWaiting: false };
    case "inactive":
      return { label: "Policy not in force", tone: "danger", isWaiting: false };
    case "error":
      return { label: "The payer returned an error", tone: "warning", isWaiting: false };
    case "unknown":
      return {
        label: "The payer did not say whether the policy is in force",
        tone: "warning",
        isWaiting: false,
      };
    default:
      return {
        label: check.nhcx_status === "queued" ? "Waiting to send" : "Sent — waiting for the payer",
        tone: "info",
        isWaiting: true,
      };
  }
}

const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });

/** An allowed or used value: money as ₹, units as a number, words as given. */
export function formatBenefitValue(value: number | string | null, currency: string | null): string {
  if (value === null) return "—";
  if (typeof value === "string") return value;
  if (currency === "INR") return `₹${inr.format(value)}`;
  return currency ? `${inr.format(value)} ${currency}` : inr.format(value);
}

/** Minutes as "42 min" or "1 h 5 min". */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const rest = minutes % 60;
  const hours = `${Math.floor(minutes / 60)} h`;
  return rest ? `${hours} ${rest} min` : hours;
}

export interface SlaSummary {
  label: string;
  tone: BadgeTone;
  isBreached: boolean;
}

/** The IRDAI clock in words — the badge carries this text, not colour alone. */
export function summariseSla(sla: PreauthSla): SlaSummary {
  const limit = formatMinutes(sla.limit_minutes);
  const elapsed = sla.elapsed_minutes ?? 0;
  switch (sla.state) {
    case "running":
      return {
        label: `${formatMinutes(elapsed)} of ${limit} — waiting`,
        tone: "info",
        isBreached: false,
      };
    case "met":
      return {
        label: `Decided in ${formatMinutes(elapsed)} (limit ${limit})`,
        tone: "success",
        isBreached: false,
      };
    case "breached":
      return {
        label: `Over the ${limit} limit by ${formatMinutes(Math.max(elapsed - sla.limit_minutes, 0))}`,
        tone: "danger",
        isBreached: true,
      };
    default:
      return { label: "Not sent yet", tone: "neutral", isBreached: false };
  }
}
