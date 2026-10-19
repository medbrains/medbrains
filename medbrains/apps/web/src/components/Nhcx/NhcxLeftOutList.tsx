import { Stack, Text } from "@mantine/core";
import type { NhcxLeftOutDocument } from "@medbrains/types";
import { Alert } from "@/components/ui";

interface NhcxLeftOutListProps {
  items: NhcxLeftOutDocument[];
  /** Past tense once the claim has gone. */
  sent?: boolean;
}

/** Documents a final claim does not carry, each with its reason. */
export function NhcxLeftOutList({ items, sent = false }: NhcxLeftOutListProps) {
  if (items.length === 0) return null;
  return (
    <Alert tone="warning" title={sent ? "Not sent to the payer" : "Will not be sent"}>
      <Stack gap={2}>
        {items.map((l) => (
          <Text key={`${l.kind}-${l.title}`} size="xs">
            {l.title} — {l.reason}
          </Text>
        ))}
      </Stack>
    </Alert>
  );
}
