import { Stack, Text, Textarea } from "@mantine/core";
import { IconAlertTriangle } from "@tabler/icons-react";
import { Alert } from "@/components/ui";

interface CounterSafetyBlockProps {
  message: string;
  canOverride: boolean;
  reason: string;
  onReasonChange: (reason: string) => void;
}

/**
 * The server's medication safety refusal for the counter basket, with the
 * override reason only a pharmacist holding the right may give against it.
 */
export function CounterSafetyBlock({
  message,
  canOverride,
  reason,
  onReasonChange,
}: CounterSafetyBlockProps) {
  return (
    <Alert
      tone="danger"
      icon={<IconAlertTriangle size={16} />}
      title="Stopped by the medication safety check"
      mb="sm"
    >
      <Stack gap={4}>
        <Text size="sm">{message}</Text>
        {canOverride ? (
          <Textarea
            label="Override reason"
            required
            autosize
            minRows={2}
            value={reason}
            onChange={(e) => onReasonChange(e.currentTarget.value)}
            error={
              reason.trim().length < 5
                ? "A clinical reason (≥5 chars) is needed to sell past this"
                : undefined
            }
          />
        ) : (
          <Text size="sm">
            Only a pharmacist with override rights can sell this. Change the basket or ask them.
          </Text>
        )}
      </Stack>
    </Alert>
  );
}
