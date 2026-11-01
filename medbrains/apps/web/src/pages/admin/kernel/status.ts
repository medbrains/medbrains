import type { ChainVerdict, RlsMode } from "@medbrains/types";
import type { BadgeTone } from "@/components/ui";

/** One kernel check as the page shows it: a word, a tone, and a sentence. */
export interface CheckStatus {
  label: string;
  tone: BadgeTone;
  detail: string;
}

/** A verdict older than this means the nightly job has stopped running. */
const STALE_AFTER_MS = 48 * 60 * 60 * 1000;

export function auditChainStatus(verdict: ChainVerdict | null, now = Date.now()): CheckStatus {
  if (!verdict?.completed_at) {
    return {
      label: "Never verified",
      tone: "warning",
      detail: "The nightly check has not verified this hospital's audit log yet.",
    };
  }
  const when = new Date(verdict.completed_at);
  if (!verdict.valid) {
    return {
      label: "Broken",
      tone: "danger",
      detail: `The audit log was altered: the chain breaks at entry ${verdict.broken_at ?? "unknown"} (checked ${when.toLocaleString()}).`,
    };
  }
  if (now - when.getTime() > STALE_AFTER_MS) {
    return {
      label: "Out of date",
      tone: "warning",
      detail: `Last verified ${when.toLocaleString()} — the nightly check has not run since.`,
    };
  }
  return {
    label: "Verified",
    tone: "success",
    detail: `${verdict.rows_checked.toLocaleString()} entries checked, unaltered, on ${when.toLocaleString()}.`,
  };
}

export function rlsStatus(rls: RlsMode): CheckStatus {
  return rls.enforced
    ? {
        label: "Enforced",
        tone: "success",
        detail: `Requests run as ${rls.role}; the database itself keeps each hospital's records apart.`,
      }
    : {
        label: "Not enforced",
        tone: "danger",
        detail: `Requests run as ${rls.role}, which row level security does not bind — separation rests on each query. Point DATABASE_URL at medbrains_app.`,
      };
}

const ENGINES: Record<string, string> = {
  postgres: "PostgreSQL relation tuples",
  spicedb: "SpiceDB",
};

export function authzStatus(backend: string): CheckStatus {
  const engine = ENGINES[backend];
  return engine
    ? {
        label: engine,
        tone: "info",
        detail: "Answers allow, deny or unknown — an outage is never a refusal.",
      }
    : {
        label: "Unrecognised",
        tone: "warning",
        detail: `The engine reports itself as "${backend}".`,
      };
}

export function configStatus(scopes: string[]): CheckStatus {
  return {
    label: `${scopes.join(" › ")} scope`,
    tone: "info",
    detail:
      "Settings resolve at this level only. Ward, department, campus and user levels arrive with the settings tree.",
  };
}
