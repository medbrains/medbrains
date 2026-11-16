import { loadFailedTitle, QueryError } from "@/components/QueryError";

interface LoadFailedProps {
  what: string;
  error: unknown;
  onRetry: () => unknown;
  /** An earlier copy stays on screen under the banner (a failed background refetch). */
  stale?: boolean;
}

/**
 * A patient-history list whose read failed, with a retry. With no data it replaces the list's
 * empty state, which would read as a fact about the patient ("no prescriptions"); after a failed
 * refetch it sits above the last good copy and says it may be out of date.
 */
export function LoadFailed({ what, error, onRetry, stale = false }: LoadFailedProps) {
  return (
    <QueryError error={error} onRetry={() => void onRetry()} title={loadFailedTitle(what, stale)} />
  );
}
