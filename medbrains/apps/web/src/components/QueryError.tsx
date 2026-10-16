import { ApiError } from "@medbrains/api";
import { IconRefresh } from "@tabler/icons-react";
import { Alert, Button } from "@/components/ui";

interface QueryErrorProps {
  error: unknown;
  onRetry?: () => void;
  title?: string;
}

/** Why the load failed, in words that say what to do next. */
export function describeLoadError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 403) return "You don't have access to this. Ask your administrator.";
    if (error.status === 404) return "It could not be found. It may have been removed.";
    if (error.status >= 500) return "The server ran into a problem. Try again in a moment.";
    return error.message;
  }
  if (error instanceof TypeError)
    return "Couldn't reach the server. Check your connection and try again.";
  return error instanceof Error ? error.message : "Something went wrong.";
}

/**
 * A failed load, shown as a failure. An outage rendered as an empty list
 * reads as a fact about the ward; this says it did not load, and offers the
 * retry.
 */
export function QueryError({ error, onRetry, title = "This didn't load" }: QueryErrorProps) {
  return (
    <Alert tone="danger" title={title} role="alert">
      {describeLoadError(error)}
      {onRetry && (
        <Button
          tone="secondary"
          size="xs"
          mt="sm"
          leftSection={<IconRefresh size={16} />}
          onClick={onRetry}
          display="block"
        >
          Retry
        </Button>
      )}
    </Alert>
  );
}
