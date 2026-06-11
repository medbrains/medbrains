import { Text } from "@mantine/core";
import { modals } from "@mantine/modals";

interface ConfirmDestructiveOptions {
  title: string;
  /** What is about to happen, including what cannot be undone. */
  message: string;
  /** Label on the destructive button (e.g. "Void invoice"). */
  confirmLabel: string;
  onConfirm: () => void;
}

/**
 * Standard guard for delete/void/cancel actions (audit P0 #19).
 * Every destructive mutation must run through this instead of firing
 * directly from a click handler.
 */
export function confirmDestructive(options: ConfirmDestructiveOptions): void {
  modals.openConfirmModal({
    title: options.title,
    children: <Text size="sm">{options.message}</Text>,
    labels: { confirm: options.confirmLabel, cancel: "Cancel" },
    confirmProps: { color: "danger" },
    onConfirm: options.onConfirm,
  });
}
