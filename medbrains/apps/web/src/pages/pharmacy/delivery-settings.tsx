import { Group, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button, Card, NumberField, toast } from "@/components/ui";
import { tenantSettingsService } from "@/services/tenantSettings.service";

/** Paid deliveries before cash on delivery is offered, when the hospital hasn't said. */
const DEFAULT_COD_MIN = 2;

function numberSetting(rows: { key: string; value: unknown }[], key: string, fallback: number) {
  const value = Number(rows.find((r) => r.key === key)?.value);
  return Number.isFinite(value) ? value : fallback;
}

/**
 * The hospital's delivery rules: the fee added to the bill, and how many paid
 * deliveries a patient completes before they may pay at the door.
 */
export function DeliverySettings() {
  const canManage = useHasPermission(P.ADMIN.SETTINGS_GENERAL_MANAGE);
  const queryClient = useQueryClient();
  const { data: rows } = useQuery({
    queryKey: ["tenant-settings", "pharmacy"],
    queryFn: () => tenantSettingsService.getTenantSettings("pharmacy"),
    enabled: canManage,
  });
  const [fee, setFee] = useState<number | string | null>(null);
  const [codMin, setCodMin] = useState<number | string | null>(null);
  const save = useMutation({
    mutationFn: async () => {
      await tenantSettingsService.updateTenantSetting({
        category: "pharmacy",
        key: "delivery_fee",
        value: Number(fee ?? numberSetting(rows ?? [], "delivery_fee", 0)),
      });
      await tenantSettingsService.updateTenantSetting({
        category: "pharmacy",
        key: "cod_min_deliveries",
        value: Number(codMin ?? numberSetting(rows ?? [], "cod_min_deliveries", DEFAULT_COD_MIN)),
      });
    },
    onSuccess: () => {
      toast.success("Delivery settings saved");
      void queryClient.invalidateQueries({ queryKey: ["tenant-settings", "pharmacy"] });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Not saved" }),
  });

  if (!canManage || !rows) return null;
  return (
    <Card padding="md">
      <Text fw={600} size="sm" mb="xs">
        Delivery settings
      </Text>
      <Group align="flex-end" gap="md" wrap="wrap">
        <NumberField
          label="Delivery fee (₹)"
          description="Added to the bill. 0 for free delivery."
          min={0}
          decimalScale={2}
          w={200}
          value={fee ?? numberSetting(rows, "delivery_fee", 0)}
          onChange={setFee}
        />
        <NumberField
          label="Cash on delivery after"
          description="Paid deliveries first. 0 offers it to everyone."
          min={0}
          max={50}
          w={220}
          value={codMin ?? numberSetting(rows, "cod_min_deliveries", DEFAULT_COD_MIN)}
          onChange={setCodMin}
        />
        <Button tone="primary" loading={save.isPending} onClick={() => save.mutate()}>
          Save
        </Button>
      </Group>
    </Card>
  );
}
