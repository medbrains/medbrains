// Pharmacy-finance CashDrawerTab — split from pharmacy-finance.tsx (pure move).

import { Card, Group, Stack, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { FieldAccessLevel } from "@medbrains/types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Badge, type BadgeTone, Button } from "@/components/ui";
import { pharmacyFinanceService } from "@/services/pharmacyFinance.service";
import { CloseDrawerModal } from "./close-drawer-modal";
import { OpenDrawerModal } from "./open-drawer-modal";
import type { CashDrawerRow } from "./shared";
import { canEditFinanceAmount, financeAmountText } from "./shared";

const drawerStatusColor: Record<string, BadgeTone> = {
  open: "success",
  closed: "neutral",
  variance_pending_signoff: "warning",
  reopened: "info",
};

export function CashDrawerTab({
  canView,
  canOpen,
  canClose,
  amountAccess,
}: {
  canView: boolean;
  canOpen: boolean;
  canClose: boolean;
  amountAccess: FieldAccessLevel;
}) {
  const qc = useQueryClient();
  const [openModal, { open: openOpenDrawerModal, close: closeOpenDrawerModal }] =
    useDisclosure(false);
  const [closeFor, setCloseFor] = useState<CashDrawerRow | null>(null);
  const canUseOwnDrawer = canView || canOpen || canClose;
  const canEditAmount = canEditFinanceAmount(amountAccess);
  const canOpenWithAmount = canOpen && canEditAmount;
  const canCloseWithAmount = canClose && canEditAmount;

  const { data: active } = useQuery({
    queryKey: ["cash-drawer", "active"],
    queryFn: () => pharmacyFinanceService.getMyActiveCashDrawer() as Promise<CashDrawerRow | null>,
    enabled: canUseOwnDrawer,
  });
  const { data: list } = useQuery({
    queryKey: ["cash-drawers"],
    queryFn: () =>
      pharmacyFinanceService.listCashDrawers({ limit: 50 }) as Promise<CashDrawerRow[]>,
    enabled: canView,
  });

  return (
    <Stack>
      {active ? (
        <Card withBorder padding="md">
          <Group justify="space-between">
            <Stack gap={2}>
              <Group gap="xs">
                <Badge tone={drawerStatusColor[active.status] ?? "neutral"}>{active.status}</Badge>
                <Text fw={600}>Drawer {active.id.slice(0, 8)}</Text>
              </Group>
              <Text size="sm" c="dimmed">
                Opened {new Date(active.opened_at).toLocaleString()} · Float{" "}
                {financeAmountText(amountAccess, active.opening_float)}
              </Text>
            </Stack>
            {canCloseWithAmount ? (
              <Button tone="danger" onClick={() => setCloseFor(active)}>
                Close drawer
              </Button>
            ) : canClose ? (
              <Button tone="danger" disabled>
                Close drawer
              </Button>
            ) : (
              <Badge>Active drawer</Badge>
            )}
          </Group>
        </Card>
      ) : (
        <Card withBorder padding="md">
          <Group justify="space-between">
            <Text>No active drawer.</Text>
            {canOpen && (
              <Button tone="primary" onClick={openOpenDrawerModal} disabled={!canOpenWithAmount}>
                Open drawer
              </Button>
            )}
          </Group>
        </Card>
      )}

      {(canOpen || canClose) && !canEditAmount && (
        <Alert tone="warning">
          Cash drawer opening and closing need billing amount edit access.
        </Alert>
      )}

      {canView ? (
        <Stack gap="xs">
          <Text fw={600}>Recent drawers</Text>
          {list?.map((row) => (
            <Card key={row.id} withBorder padding="sm">
              <Group justify="space-between">
                <Group gap="xs">
                  <Badge tone={drawerStatusColor[row.status] ?? "neutral"}>{row.status}</Badge>
                  <Text>Opened {new Date(row.opened_at).toLocaleDateString()}</Text>
                </Group>
                <Text>
                  Float {financeAmountText(amountAccess, row.opening_float)}
                  {row.actual_close_amount &&
                    ` · Closed ${financeAmountText(amountAccess, row.actual_close_amount)}`}
                  {row.variance && ` · Var ${financeAmountText(amountAccess, row.variance)}`}
                </Text>
              </Group>
            </Card>
          ))}
        </Stack>
      ) : (
        <Alert tone="neutral">Recent drawer history requires cash-drawer view permission.</Alert>
      )}

      <OpenDrawerModal
        opened={openModal && canOpenWithAmount}
        onClose={closeOpenDrawerModal}
        onOpened={() => {
          qc.invalidateQueries({ queryKey: ["cash-drawer"] });
          qc.invalidateQueries({ queryKey: ["cash-drawers"] });
        }}
        amountAccess={amountAccess}
      />
      <CloseDrawerModal
        drawer={closeFor}
        onClose={() => setCloseFor(null)}
        onClosed={() => {
          qc.invalidateQueries({ queryKey: ["cash-drawer"] });
          qc.invalidateQueries({ queryKey: ["cash-drawers"] });
        }}
        amountAccess={amountAccess}
      />
    </Stack>
  );
}
