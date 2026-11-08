// The count on the "Charges needing attention" tab: open items the viewer
// may see. A count that could not be read shows "?", never zero.

import { useHasAnyPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui";
import { billingService } from "@/services/billing.service";

const OPEN_COUNT = { status: "open", limit: "1" };

/** Badge with the open count; hidden at zero, "?" when the count failed. */
export function ChargeAttentionCount() {
  const canView = useHasAnyPermission([P.BILLING.CHARGE_ATTENTION.VIEW, P.BILLING.LEAKAGE.VIEW]);
  const { data, isError } = useQuery({
    queryKey: ["billing", "charge-attention", OPEN_COUNT],
    queryFn: () => billingService.listChargeAttention(OPEN_COUNT),
    enabled: canView,
  });
  if (isError) {
    return (
      <Badge size="sm" tone="danger" aria-label="Count unavailable">
        ?
      </Badge>
    );
  }
  const total = data?.meta.total ?? 0;
  if (total === 0) return null;
  return (
    <Badge size="sm" tone="accent" aria-label={`${total} charges need attention`}>
      {total}
    </Badge>
  );
}
