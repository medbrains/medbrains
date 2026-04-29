/**
 * CrdtSyncBadge — Mantine badge showing CRDT sync status. Replaces
 * the duplicated SyncBadge logic each Offline* sibling component
 * was carrying inline.
 */

import type { ReactNode } from "react";
import { Badge } from "@mantine/core";
import {
  IconAlertCircle,
  IconCheck,
  IconCloud,
  IconCloudOff,
  IconRefresh,
} from "@tabler/icons-react";
import type { CrdtConnectionStatus } from "./types";

export interface CrdtSyncBadgeProps {
  status: CrdtConnectionStatus;
  unsyncedOps: number;
  /** "Synced" by default; pass "Saved" for note-style components. */
  syncedLabel?: string;
  /** Optional override for the in-flight icon during "syncing". */
  syncingIcon?: ReactNode;
}

export function CrdtSyncBadge({
  status,
  unsyncedOps,
  syncedLabel = "Synced",
  syncingIcon,
}: CrdtSyncBadgeProps) {
  switch (status) {
    case "online":
      return unsyncedOps > 0 ? (
        <Badge color="orange" leftSection={<IconCloudOff size={12} />}>
          {unsyncedOps} pending
        </Badge>
      ) : (
        <Badge color="teal" leftSection={<IconCheck size={12} />}>
          {syncedLabel}
        </Badge>
      );
    case "offline":
      return (
        <Badge color="orange" leftSection={<IconCloudOff size={12} />}>
          Offline {unsyncedOps > 0 ? `· ${unsyncedOps} queued` : ""}
        </Badge>
      );
    case "syncing":
      return (
        <Badge
          color="blue"
          leftSection={syncingIcon ?? <IconRefresh size={12} />}
        >
          Syncing…
        </Badge>
      );
    case "error":
      return (
        <Badge color="red" leftSection={<IconAlertCircle size={12} />}>
          Edge error
        </Badge>
      );
    default:
      return (
        <Badge color="gray" leftSection={<IconCloud size={12} />}>
          Connecting
        </Badge>
      );
  }
}
