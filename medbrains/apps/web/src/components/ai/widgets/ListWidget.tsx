import { Group, List, Text } from "@mantine/core";
import { Badge } from "@/components/ui";
import type { AiWidget } from "../transport/types";
import { statusTone } from "./format";

type ListData = Extract<AiWidget, { kind: "list" }>;

/** Items shown in the chat panel; the full-screen view shows all. */
const COMPACT_ITEMS = 8;

/** Items with their recorded status as a chip (the word is always shown). */
export function ListWidget({ widget, full = false }: { widget: ListData; full?: boolean }) {
  const items = full ? widget.items : widget.items.slice(0, COMPACT_ITEMS);
  const more = widget.items.length - items.length;
  return (
    <List spacing={6} listStyleType="none">
      {items.map((item) => (
        <List.Item key={`${item.label}-${item.status ?? ""}`}>
          <Group gap="xs" wrap="nowrap" justify="space-between">
            <Text size="sm">{item.label}</Text>
            {item.status && (
              <Badge tone={statusTone(item.status)} size="sm">
                {item.status}
              </Badge>
            )}
          </Group>
        </List.Item>
      ))}
      {more > 0 && (
        <List.Item>
          <Text size="xs" c="dimmed">
            and {more} more — open full screen to see all
          </Text>
        </List.Item>
      )}
    </List>
  );
}
