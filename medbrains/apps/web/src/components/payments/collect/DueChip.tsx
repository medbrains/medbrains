import { useHotkeys } from "@mantine/hooks";
import type { BillingLaneName } from "@medbrains/types";
import { IconCash, IconRefresh } from "@tabler/icons-react";
import { Badge, Button } from "@/components/ui";
import { billsDue, focusBills, rupees } from "./collect-math";
import { useCollect } from "./collect-store";
import { useCanCollect, useDues } from "./use-dues";

export interface DueChipProps {
  patientId: string;
  /** The screen's department: the chip shows and collects its dues. */
  lane?: BillingLaneName;
  encounterId?: string;
}

/**
 * "₹X due · Collect" on a patient banner: opens the Collect drawer for this
 * screen's department. `C` opens it too. A user who may not collect here sees
 * no chip — the banner keeps its plain outstanding figure.
 */
export function DueChip({ patientId, lane, encounterId }: DueChipProps) {
  const canCollect = useCanCollect(lane);
  const dues = useDues(patientId, canCollect);
  const open = useCollect((s) => s.open);
  const focus = { lane, encounterId };
  const due = dues.data ? billsDue(focusBills(dues.data.bills, focus)) : 0;
  const total = dues.data ? billsDue(dues.data.bills) : 0;
  const collect = () => open({ patientId, ...focus });
  useHotkeys(canCollect && due > 0 ? [["c", collect]] : []);

  if (!canCollect) return null;
  if (dues.isError) {
    return (
      <Button
        tone="ghost"
        size="xs"
        leftSection={<IconRefresh size={14} />}
        onClick={() => void dues.refetch()}
        data-testid="due-chip-error"
      >
        Dues unavailable
      </Button>
    );
  }
  if (!dues.data || dues.data.amounts_hidden) return null;
  if (due <= 0) {
    return total > 0 ? (
      <Badge tone="warning" data-testid="due-chip-elsewhere">
        {rupees(total)} due at other desks
      </Badge>
    ) : null;
  }
  return (
    <Button
      tone="primary"
      size="xs"
      leftSection={<IconCash size={14} />}
      onClick={collect}
      aria-keyshortcuts="C"
      data-testid="due-chip"
    >
      {rupees(due)} due · Collect
    </Button>
  );
}
