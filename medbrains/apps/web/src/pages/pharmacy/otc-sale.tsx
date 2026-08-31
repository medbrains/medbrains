import { Group, Stack, Text, Textarea } from "@mantine/core";
import type { CreateOtcSaleRequest } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconArrowLeft, IconPlus, IconShoppingCart } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router";
import { PageHeader } from "@/components";
import { MedicineOrderLineCard } from "@/components/Pharmacy/MedicineOrderLineCard";
import { Button, toast } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { pharmacyService } from "@/services/pharmacy.service";
import styles from "../pharmacy.module.scss";
import type { DraftPharmacyOrderItem } from "./shared";
import { draftPharmacyOrderItemsPayload, newDraftPharmacyOrderItem } from "./shared";

/**
 * A walk-in sale over the counter, on a screen rather than in a drawer.
 *
 * This is the one pharmacy path with no prescription and no patient record
 * behind it — somebody buys paracetamol and leaves — so the only record that
 * it happened is what is typed here. A drawer over the orders list gave a
 * multi-line basket a third of the width, and the lines are where the
 * mistakes are.
 */
export function PharmacyOtcSalePage() {
  useRequirePermission(P.PHARMACY.POS_CREATE);

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<DraftPharmacyOrderItem[]>([newDraftPharmacyOrderItem()]);

  const backToOrders = () => navigate("/pharmacy?tab=orders");

  const createSale = useMutation({
    mutationFn: (data: CreateOtcSaleRequest) => pharmacyService.createOtcSale(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-orders"] });
      toast.success("Walk-in sale recorded", { title: "OTC Sale" });
      backToOrders();
    },
    onError: (error: Error) => toast.error(error.message, { title: "Could not record the sale" }),
  });

  return (
    <Stack>
      <PageHeader
        title="OTC Walk-in Sale"
        icon={<IconShoppingCart size={20} stroke={1.5} />}
        actions={
          <Button tone="secondary" leftSection={<IconArrowLeft size={14} />} onClick={backToOrders}>
            Orders
          </Button>
        }
      />
      <Stack maw={860}>
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
              createSale.mutate({
                items: draftPharmacyOrderItemsPayload(items),
                notes: notes || undefined,
              })
            }
            loading={createSale.isPending}
          >
            Record OTC Sale
          </Button>
        </Group>
      </Stack>
    </Stack>
  );
}
