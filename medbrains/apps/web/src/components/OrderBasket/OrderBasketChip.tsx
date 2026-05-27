import { Badge, Button } from "@mantine/core";
import { useHasPermission, useOrderBasketStore } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { IconShoppingCart } from "@tabler/icons-react";

interface OrderBasketChipProps {
  onClick: () => void;
  requiredPermission?: string;
}

/**
 * Compact entry-point button. Mounts inside Active Visit bar (when that
 * lands from other chat's sprint) or any encounter-scoped header. Shows
 * basket size as a badge.
 */
export function OrderBasketChip({
  onClick,
  requiredPermission = P.ORDER_BASKET.SIGN,
}: OrderBasketChipProps) {
  const itemCount = useOrderBasketStore((s) => s.items.length);
  const isChecking = useOrderBasketStore((s) => s.isChecking);
  const canOpenBasket = useHasPermission(requiredPermission);

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
      onClick={() => {
        if (canOpenBasket) onClick();
      }}
      disabled={!canOpenBasket}
      loading={isChecking}
    >
      Order Basket
    </Button>
  );
}
