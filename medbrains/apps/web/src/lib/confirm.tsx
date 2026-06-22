import { Text } from "@mantine/core";
import { modals } from "@mantine/modals";
import type { ReactNode } from "react";

interface ConfirmDestructiveOptions {
  /** Dialog heading, e.g. "Delete role". */
  title: string;
  /** Body — a string is wrapped in a muted Text; pass a node for richer content. */
  message: ReactNode;
  /** Confirm button label. Default "Delete". */
  confirmLabel?: string;
  /** Cancel button label. Default "Cancel". */
  cancelLabel?: string;
  /** Runs when the user confirms. */
  onConfirm: () => void;
}

/**
 * Guard a destructive action (delete / void / cancel / deactivate) behind a
 * confirmation dialog. A misclick must never irreversibly destroy data — this is
 * the single helper every destructive control should route through.
 *
 * Uses the app-wide Mantine ModalsProvider, so no per-page modal state. The
 * confirm button is danger-toned; Escape / overlay-click cancels.
 */
export function confirmDestructive({
  title,
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  onConfirm,
}: ConfirmDestructiveOptions): void {
  modals.openConfirmModal({
    title,
    centered: true,
    children: typeof message === "string" ? <Text size="sm">{message}</Text> : message,
    labels: { confirm: confirmLabel, cancel: cancelLabel },
    confirmProps: { color: "danger" },
    onConfirm,
  });
}
