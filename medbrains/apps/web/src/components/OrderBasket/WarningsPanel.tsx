import { Alert, Badge, Group, Stack, Text, TextInput } from "@mantine/core";
import { IconAlertTriangle, IconInfoCircle } from "@tabler/icons-react";
import type { BasketWarning, BasketWarningAck } from "@medbrains/types";

interface WarningsPanelProps {
  warnings: BasketWarning[];
  acknowledged: BasketWarningAck[];
  onAcknowledge: (code: string, override_reason: string) => void;
}

export function WarningsPanel({ warnings, acknowledged, onAcknowledge }: WarningsPanelProps) {
  if (warnings.length === 0) return null;

  // De-duplicate by code (multiple refs collapse to one banner)
  const byCode = new Map<string, BasketWarning>();
  for (const w of warnings) {
    if (!byCode.has(w.code)) byCode.set(w.code, w);
  }

  return (
    <Stack gap="xs">
      {Array.from(byCode.values()).map((w) => {
        const isBlock = w.severity === "BLOCK";
        const ack = acknowledged.find((a) => a.code === w.code);
        return (
          <Alert
            key={w.code}
            color={isBlock ? "red" : "yellow"}
            icon={isBlock ? <IconAlertTriangle size={16} /> : <IconInfoCircle size={16} />}
            variant="light"
          >
            <Stack gap={4}>
              <Group gap="xs">
                <Badge size="xs" color={isBlock ? "red" : "yellow"}>
                  {w.severity}
                </Badge>
                <Text size="sm" fw={500}>
                  {w.code}
                </Text>
              </Group>
              <Text size="sm">{w.message}</Text>
              {isBlock && (
                <TextInput
                  size="xs"
                  label="Override reason (required to sign)"
                  placeholder="e.g., monitoring INR daily, benefit > risk"
                  value={ack?.override_reason ?? ""}
                  onChange={(e) =>
                    onAcknowledge(w.code, e.currentTarget.value)
                  }
                  required
                />
              )}
            </Stack>
          </Alert>
        );
      })}
    </Stack>
  );
}
