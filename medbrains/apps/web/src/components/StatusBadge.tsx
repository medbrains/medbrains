import { Badge } from "@mantine/core";
import {
  AlertTriangle,
  Check,
  CircleDot,
  Clock,
  Eye,
  FileCheck,
  Hourglass,
  type LucideIcon,
  Play,
  X,
} from "lucide-react";
import { AnimatedIcon, type AnimatedIconMotion } from "./AnimatedIcon";

interface StatusConfig {
  color: string;
  icon: LucideIcon;
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
  waiting: { color: "info", icon: Clock, label: "Waiting", motion: "pulse" },
  called: { color: "warning", icon: Play, label: "Called", motion: "bounce" },
  in_consultation: { color: "orange", icon: Eye, label: "In Consultation", motion: "float" },
  completed: { color: "success", icon: Check, label: "Completed" },
  no_show: { color: "danger", icon: X, label: "No Show" },

  // Lab statuses
  ordered: { color: "info", icon: Clock, label: "Ordered" },
  sample_collected: {
    color: "warning",
    icon: Hourglass,
    label: "Sample Collected",
    motion: "float",
  },
  processing: { color: "orange", icon: CircleDot, label: "Processing", motion: "pulse" },
  verified: { color: "success", icon: FileCheck, label: "Verified" },
  cancelled: { color: "danger", icon: X, label: "Cancelled" },

  // Billing statuses
  draft: { color: "slate", icon: Clock, label: "Draft" },
  issued: { color: "info", icon: FileCheck, label: "Issued" },
  partially_paid: {
    color: "warning",
    icon: AlertTriangle,
    label: "Partially Paid",
    motion: "pulse",
  },
  paid: { color: "success", icon: Check, label: "Paid" },

  // IPD statuses
  admitted: { color: "info", icon: Play, label: "Admitted" },
  discharged: { color: "success", icon: Check, label: "Discharged" },

  // Generic
  active: { color: "success", icon: CircleDot, label: "Active", motion: "pulse" },
  inactive: { color: "slate", icon: X, label: "Inactive" },
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
