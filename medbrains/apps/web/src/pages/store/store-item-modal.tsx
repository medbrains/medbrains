import { Loader, Stack, Text } from "@mantine/core";
import type { StoreItem } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { Alert, Modal } from "@/components/ui";
import { portalService } from "@/services/portal.service";
import { StoreItemBadges, StoreItemCard } from "./store-item-card";

interface StoreItemModalProps {
  tenantCode: string;
  item: StoreItem | null;
  onClose: () => void;
  onOpen: (item: StoreItem) => void;
  onAdd?: (item: StoreItem) => void;
}

/**
 * An item's page: generic name, maker, pack, MRP and schedule, and other
 * brands of the same medicine to compare — only to compare: the pharmacy
 * never swaps a brand without the prescriber's and the patient's consent.
 */
export function StoreItemModal({ tenantCode, item, onClose, onOpen, onAdd }: StoreItemModalProps) {
  const page = useQuery({
    queryKey: ["store-item", tenantCode, item?.id],
    queryFn: () => portalService.getStoreItem(tenantCode, item?.id ?? ""),
    enabled: item !== null,
  });
  return (
    <Modal opened={item !== null} onClose={onClose} title={item?.name ?? ""}>
      {page.isLoading && <Loader size="sm" />}
      {page.isError && (
        <Alert tone="warning" title="Couldn't load this medicine">
          Try again in a moment.
        </Alert>
      )}
      {page.data && (
        <Stack gap="sm">
          <Text size="sm">Generic name: {page.data.item.inn ?? "—"}</Text>
          <Text size="sm">Made by: {page.data.item.manufacturer ?? "—"}</Text>
          <Text size="sm">Pack: {page.data.item.pack ?? "—"}</Text>
          <Text size="sm">MRP: {page.data.item.mrp ? `₹${page.data.item.mrp}` : "—"}</Text>
          <StoreItemBadges item={page.data.item} />
          {page.data.substitutes.length > 0 && (
            <>
              <Text fw={600} size="sm">
                Same medicine, other brands
              </Text>
              <Text size="xs" c="dimmed">
                To compare only. Ask your doctor before changing brand.
              </Text>
              {page.data.substitutes.map((s) => (
                <StoreItemCard key={s.id} item={s} onOpen={onOpen} onAdd={onAdd} />
              ))}
            </>
          )}
        </Stack>
      )}
    </Modal>
  );
}
