import { useFailedQueries } from "@/hooks/useFailedQueries";
import { QueryError } from "./QueryError";

/**
 * Shell-level: any failed load on the current screen surfaces here, so a
 * page that never wired its own error state still does not pass an outage
 * off as "nothing to show".
 */
export function PageQueryErrorBanner() {
  const { error, retry } = useFailedQueries();
  if (!error) return null;
  return <QueryError error={error} onRetry={retry} title="Part of this page didn't load" />;
}
