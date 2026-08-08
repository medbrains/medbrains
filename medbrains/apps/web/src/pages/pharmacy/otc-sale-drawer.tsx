// IPD OtcSaleDrawer — split from pharmacy.tsx (pure move).

import { Drawer, Group, Stack, Text, Textarea } from "@mantine/core";
import type { CreateOtcSaleRequest } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { MedicineOrderLineCard } from "@/components/Pharmacy/MedicineOrderLineCard";
import { Button, toast } from "@/components/ui";
import { pharmacyService } from "@/services/pharmacy.service";
import styles from "../pharmacy.module.scss";
import type { DraftPharmacyOrderItem } from "./shared";
import { draftPharmacyOrderItemsPayload, newDraftPharmacyOrderItem } from "./shared";

export function OtcSaleDrawer({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<DraftPharmacyOrderItem[]>([newDraftPharmacyOrderItem()]);

  const createMutation = useMutation({
    mutationFn: (data: CreateOtcSaleRequest) => pharmacyService.createOtcSale(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-orders"] });
      toast.success("Walk-in sale recorded", { title: "OTC Sale" });
      onClose();
      setNotes("");
      setItems([newDraftPharmacyOrderItem()]);
    },
    onError: () => {
      toast.error("Failed to record OTC sale", { title: "Error" });
    },
  });

  return (
    <Drawer opened={opened} onClose={onClose} title="OTC Walk-in Sale" position="right" size="xl">
      <Stack>
        <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.currentTarget.value)} />
        <Text fw={600} size="sm">
          Items
        </Text>
        {items.map((item, idx) => (
          <MedicineOrderLineCard
            key={item.row_id}
            value={item}
            index={idx}
            priceLabel="Price"
            className={styles.medicationCard}
            removePermission={P.PHARMACY.POS_CREATE}
            onChange={(next) => {
              const updated = [...items];
              updated[idx] = { ...item, ...next };
              setItems(updated);
            }}
            canRemove={items.length > 1}
            onRemove={() => setItems(items.filter((_, i) => i !== idx))}
          />
        ))}
        <Group>
          <Button
            size="xs"
            tone="secondary"
            leftSection={<IconPlus size={14} />}
            onClick={() => setItems([...items, newDraftPharmacyOrderItem()])}
          >
            Add medicine
          </Button>
          <Button
            size="xs"
            tone="primary"
            onClick={() =>
              createMutation.mutate({
                items: draftPharmacyOrderItemsPayload(items),
                notes: notes || undefined,
              })
            }
            loading={createMutation.isPending}
          >
            Record OTC Sale
          </Button>
        </Group>
      </Stack>
    </Drawer>
  );
}
