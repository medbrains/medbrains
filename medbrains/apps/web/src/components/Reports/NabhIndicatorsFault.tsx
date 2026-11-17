// The NABH rollup fails as a whole when any indicator query fails (#6021), so
// a database fault is never shown as "pending" tiles or an empty catalogue.

import { Text } from "@mantine/core";
import { Alert } from "@/components/ui";

interface NabhIndicatorsStatusProps {
  isLoading: boolean;
  isError: boolean;
}

/** Loading text, or the fault notice when the indicators could not be calculated. */
export function NabhIndicatorsStatus({ isLoading, isError }: NabhIndicatorsStatusProps) {
  if (isError) {
    return (
      <Alert tone="danger" title="Couldn't calculate the indicators">
        A database query failed, so no figure below is current. Reload the page; if it fails again,
        tell IT support. Nothing is pending: the calculation did not run.
      </Alert>
    );
  }
  return isLoading ? <Text c="dimmed">Aggregating from across the system…</Text> : null;
}
