/**
 * The cash drawer, on the counter that takes the cash.
 *
 * Opening and closing a drawer lived only on the pharmacy-finance page, so a
 * cashier could ring cash sales into no drawer at all and the close had
 * nothing to count against. Cash at the counter now needs an open drawer.
 */
import { Group, Text } from "@mantine/core";
import { useFieldAccess, useHasAnyPermission, useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { IconCash } from "@tabler/icons-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Button } from "@/components/ui";
import { CloseDrawerModal } from "@/pages/pharmacy-finance/close-drawer-modal";
import { OpenDrawerModal } from "@/pages/pharmacy-finance/open-drawer-modal";
import type { CashDrawerRow } from "@/pages/pharmacy-finance/shared";
import { financeAmountText } from "@/pages/pharmacy-finance/shared";
import { pharmacyFinanceService } from "@/services/pharmacyFinance.service";
import { UnclosedDayNotice } from "./unclosed-day-notice";

const ACTIVE_DRAWER_KEY = ["cash-drawer", "active"] as const;

/** The signed-in cashier's open drawer; `undefined` while loading or not permitted. */
export function useActiveCashDrawer() {
  const canUse = useHasAnyPermission([
    P.PHARMACY_FINANCE.CASH_DRAWER_VIEW,
    P.PHARMACY_FINANCE.CASH_DRAWER_OPEN,
    P.PHARMACY_FINANCE.CASH_DRAWER_CLOSE,
  ]);
  return useQuery({
    queryKey: ACTIVE_DRAWER_KEY,
    queryFn: () => pharmacyFinanceService.getMyActiveCashDrawer() as Promise<CashDrawerRow | null>,
    enabled: canUse,
  });
}

export function CounterDrawer() {
  const qc = useQueryClient();
  const amountAccess = useFieldAccess("billing.amount");
  const canOpen = useHasPermission(P.PHARMACY_FINANCE.CASH_DRAWER_OPEN);
  const canClose = useHasPermission(P.PHARMACY_FINANCE.CASH_DRAWER_CLOSE);
  const { data: drawer, isError } = useActiveCashDrawer();
  const [opening, setOpening] = useState(false);
  const [closing, setClosing] = useState<CashDrawerRow | null>(null);
  const refresh = () => void qc.invalidateQueries({ queryKey: ["cash-drawer"] });

  if (isError) {
    // A failed lookup is not "no drawer" — say we cannot tell.
    return <Alert tone="warning">The cash drawer could not be checked. Cash is held.</Alert>;
  }

  return (
    <>
      {drawer && <UnclosedDayNotice locationId={drawer.pharmacy_location_id} />}
      {drawer ? (
        <Group justify="space-between" data-testid="counter-drawer">
          <Text size="sm">
            <IconCash size={16} /> Drawer open since{" "}
            {new Date(drawer.opened_at).toLocaleTimeString()} · float{" "}
            {financeAmountText(amountAccess, drawer.opening_float)}
          </Text>
          {canClose && (
            <Button size="compact-sm" tone="secondary" onClick={() => setClosing(drawer)}>
              Close drawer and cash up
            </Button>
          )}
        </Group>
      ) : (
        <Alert tone="warning" data-testid="counter-drawer">
          <Group justify="space-between">
            <Text size="sm">No cash drawer is open. UPI and card work; cash needs a drawer.</Text>
            {canOpen && (
              <Button size="compact-sm" tone="primary" onClick={() => setOpening(true)}>
                Open drawer
              </Button>
            )}
          </Group>
        </Alert>
      )}
      <OpenDrawerModal
        opened={opening}
        onClose={() => setOpening(false)}
        onOpened={refresh}
        amountAccess={amountAccess}
      />
      <CloseDrawerModal
        drawer={closing}
        onClose={() => setClosing(null)}
        onClosed={refresh}
        amountAccess={amountAccess}
      />
    </>
  );
}
