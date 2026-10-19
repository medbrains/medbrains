import type { PreauthSla } from "@medbrains/types";
import { IconAlertTriangle, IconCircleCheck, IconClock } from "@tabler/icons-react";
import { Badge } from "@/components/ui";
import { summariseSla } from "./eligibilitySummary";

/** The IRDAI clock as a badge: icon and words, never colour alone. */
export function NhcxSlaBadge({ sla }: { sla: PreauthSla }) {
  const s = summariseSla(sla);
  const Icon = s.isBreached ? IconAlertTriangle : sla.state === "met" ? IconCircleCheck : IconClock;
  return (
    <Badge tone={s.tone} leftSection={<Icon size={16} aria-hidden />}>
      {s.label}
    </Badge>
  );
}
