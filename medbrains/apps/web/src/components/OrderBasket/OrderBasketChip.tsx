import { Badge, Button } from "@mantine/core";
import { IconShoppingCart } from "@tabler/icons-react";
import { useOrderBasketStore } from "@medbrains/stores";

interface OrderBasketChipProps {
  onClick: () => void;
}

/**
 * Compact entry-point button. Mounts inside Active Visit bar (when that
 * lands from other chat's sprint) or any encounter-scoped header. Shows
 * basket size as a badge.
 */
export function OrderBasketChip({ onClick }: OrderBasketChipProps) {
  const itemCount = useOrderBasketStore((s) => s.items.length);
  const isChecking = useOrderBasketStore((s) => s.isChecking);

  return (
    <Button
      variant={itemCount > 0 ? "filled" : "light"}
      color="primary"
      size="xs"
      leftSection={<IconShoppingCart size={14} />}
      rightSection={
        itemCount > 0 ? (
          <Badge size="xs" variant="white" color="primary">
            {itemCount}
          </Badge>
        ) : null
      }
      onClick={onClick}
      loading={isChecking}
    >
      Order Basket
    </Button>
  );
}
