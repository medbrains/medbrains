import { Group, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button, Card, NumberField, toast } from "@/components/ui";
import { tenantSettingsService } from "@/services/tenantSettings.service";

const LIMIT_KEY = "pos_discount_limit_percent";

/**
 * The counter's discount limit: off MRP beyond it, a sale needs a reason and
 * an approver holding pharmacy.pos.discount_approve. Unset, it is 0 — every
 * discount is approved — until the hospital decides otherwise.
 */
export function CounterSettings() {
  const canManage = useHasPermission(P.ADMIN.SETTINGS_GENERAL_MANAGE);
  const queryClient = useQueryClient();
  const { data: rows } = useQuery({
    queryKey: ["tenant-settings", "pharmacy"],
    queryFn: () => tenantSettingsService.getTenantSettings("pharmacy"),
    enabled: canManage,
  });
  const [limit, setLimit] = useState<number | string | null>(null);
  const saved = Number(rows?.find((r) => r.key === LIMIT_KEY)?.value);
  const current = limit ?? (Number.isFinite(saved) ? saved : 0);
  const save = useMutation({
    mutationFn: () =>
      tenantSettingsService.updateTenantSetting({
        category: "pharmacy",
        key: LIMIT_KEY,
        value: Number(current),
      }),
    onSuccess: () => {
      toast.success("Counter discount limit saved");
      void queryClient.invalidateQueries({ queryKey: ["tenant-settings", "pharmacy"] });
      void queryClient.invalidateQueries({ queryKey: ["pos-prices"] });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Not saved" }),
  });

  if (!canManage || !rows) return null;
  return (
    <Card padding="md">
      <Group align="flex-end" gap="md" wrap="wrap">
        <NumberField
          label="Counter discount limit (% off MRP)"
          description="Above this, a sale needs a reason and an approver."
          min={0}
          max={100}
          decimalScale={2}
          w={280}
          value={current}
          onChange={setLimit}
        />
        <Button tone="primary" loading={save.isPending} onClick={() => save.mutate()}>
          Save
        </Button>
      </Group>
      <Text size="xs" c="dimmed" mt="xs">
        Approvals are recorded against each sale for the cashier audit.
      </Text>
    </Card>
  );
}
