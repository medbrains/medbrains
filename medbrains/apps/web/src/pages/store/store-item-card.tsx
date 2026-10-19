import { Group, Stack, Text } from "@mantine/core";
import type { StoreItem } from "@medbrains/types";
import { Badge, Button, Card } from "@/components/ui";
import { canAdd, STOCK_VIEW } from "./storefront";

interface StoreItemCardProps {
  item: StoreItem;
  /** Present when signed in: puts one in the cart. */
  onAdd?: (item: StoreItem) => void;
  adding?: boolean;
  onOpen: (item: StoreItem) => void;
}

/** One medicine in the storefront: price, MRP, stock as a word, and why it may need more. */
export function StoreItemCard({ item, onAdd, adding, onOpen }: StoreItemCardProps) {
  const stock = STOCK_VIEW[item.stock];
  return (
    <Card padding="md">
      <Stack gap="xs">
        <Button tone="ghost" size="compact-sm" onClick={() => onOpen(item)} px={0}>
          {item.name}
        </Button>
        {item.inn && (
          <Text size="xs" c="dimmed">
            {item.inn}
            {item.pack ? ` · ${item.pack}` : ""}
          </Text>
        )}
        <StoreItemBadges item={item} />
        <Group justify="space-between" align="flex-end">
          <Stack gap={0}>
            {item.price ? (
              <Text fw={600}>₹{item.price}</Text>
            ) : (
              <Text size="sm" c="dimmed">
                Price at the pharmacy
              </Text>
            )}
            {item.mrp && item.price && item.mrp !== item.price && (
              <Text size="xs" c="dimmed">
                MRP ₹{item.mrp}
              </Text>
            )}
          </Stack>
          <Badge size="sm" tone={stock.tone}>
            {stock.label}
          </Badge>
        </Group>
        {item.note && (
          <Text size="xs" c="dimmed">
            {item.note}
          </Text>
        )}
        {onAdd && canAdd(item) && (
          <Button tone="primary" size="sm" loading={adding} onClick={() => onAdd(item)}>
            Add to cart
          </Button>
        )}
      </Stack>
    </Card>
  );
}

/** Schedule, prescription and pickup marks — in words, never colour alone. */
export function StoreItemBadges({ item }: { item: StoreItem }) {
  return (
    <Group gap={4}>
      {item.schedule && (
        <Badge size="xs" tone={item.sale_class === "counter_only" ? "danger" : "warning"}>
          Schedule {item.schedule}
        </Badge>
      )}
      {item.prescription_needed && (
        <Badge size="xs" tone="info">
          Prescription needed
        </Badge>
      )}
      {item.pickup_only && item.sale_class !== "counter_only" && (
        <Badge size="xs" tone="neutral">
          Pickup only
        </Badge>
      )}
    </Group>
  );
}
