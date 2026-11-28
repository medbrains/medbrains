import { Text } from "@mantine/core";
import { Alert } from "@/components/ui";
import { splitAbdmMessage } from "./abhaRules";

interface AbhaFailureAlertProps {
  error: Error;
}

/**
 * A refused ABHA step: ABDM's own words first (NHA CRT_ABHA_105, 107), our
 * hint beneath when the server added one.
 */
export function AbhaFailureAlert({ error }: AbhaFailureAlertProps) {
  const { message, hint } = splitAbdmMessage(error.message);
  return (
    <Alert tone="danger" title="ABDM said no">
      <Text size="sm">{message}</Text>
      {hint && (
        <Text size="xs" c="var(--mb-text-secondary)" mt={4}>
          {hint}
        </Text>
      )}
    </Alert>
  );
}
