import { Badge } from "@mantine/core";
import {
  IconAlertTriangle,
  IconCheck,
  IconCircleDot,
  IconClock,
  IconEye,
  IconFileCheck,
  IconHourglass,
  IconPlayerPlay,
  IconX,
  type TablerIcon,
} from "@tabler/icons-react";
import { AnimatedIcon, type AnimatedIconMotion } from "./AnimatedIcon";

interface StatusConfig {
  color: string;
  icon: TablerIcon;
  label: string;
  motion?: AnimatedIconMotion;
}

// Semantic color mapping:
//   success (emerald) — completed, verified, paid, healthy, active
//   warning (amber)   — pending, called, partially paid, sample collected
//   info    (sky)     — waiting, ordered, issued, admitted, queued
//   danger  (rose)    — cancelled, no show, errors
//   orange            — in-progress actions (consultation, processing)
//   slate             — draft, deferred, neutral

const statusMap: Record<string, StatusConfig> = {
  // OPD statuses
  waiting: { color: "info", icon: IconClock, label: "Waiting", motion: "pulse" },
  called: { color: "warning", icon: IconPlayerPlay, label: "Called", motion: "bounce" },
  in_consultation: { color: "orange", icon: IconEye, label: "In Consultation", motion: "float" },
  completed: { color: "success", icon: IconCheck, label: "Completed" },
  no_show: { color: "danger", icon: IconX, label: "No Show" },

  // Lab statuses
  ordered: { color: "info", icon: IconClock, label: "Ordered" },
  sample_collected: {
    color: "warning",
    icon: IconHourglass,
    label: "Sample Collected",
    motion: "float",
  },
  processing: { color: "orange", icon: IconCircleDot, label: "Processing", motion: "pulse" },
  verified: { color: "success", icon: IconFileCheck, label: "Verified" },
  cancelled: { color: "danger", icon: IconX, label: "Cancelled" },

  // Billing statuses
  draft: { color: "slate", icon: IconClock, label: "Draft" },
  issued: { color: "info", icon: IconFileCheck, label: "Issued" },
  partially_paid: {
    color: "warning",
    icon: IconAlertTriangle,
    label: "Partially Paid",
    motion: "pulse",
  },
  paid: { color: "success", icon: IconCheck, label: "Paid" },

  // IPD statuses
  admitted: { color: "info", icon: IconPlayerPlay, label: "Admitted" },
  discharged: { color: "success", icon: IconCheck, label: "Discharged" },

  // Generic
  active: { color: "success", icon: IconCircleDot, label: "Active", motion: "pulse" },
  inactive: { color: "slate", icon: IconX, label: "Inactive" },
};

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusMap[status];
  if (!config) {
    return (
      <Badge color="slate" radius="xl" size="md">
        {status}
      </Badge>
    );
  }

  return (
    <Badge
      color={config.color}
      radius="xl"
      size="md"
      leftSection={<AnimatedIcon icon={config.icon} size={12} motion={config.motion} />}
    >
      {config.label}
    </Badge>
  );
}
