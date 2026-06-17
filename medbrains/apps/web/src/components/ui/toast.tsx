import { Group, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconAlertTriangle,
  IconCircleCheck,
  IconCircleX,
  IconInfoCircle,
} from "@tabler/icons-react";
import type { ReactNode } from "react";
import { Button } from "./Button";
import styles from "./toast.module.scss";

type ToastTone = "success" | "error" | "warning" | "info";

// Tone-semantic glyph in a solid tone circle (reference style). The progress
// toast keeps the ECG loader for the live "in progress" feel.
const TONE: Record<ToastTone, { color: string; icon: ReactNode }> = {
  success: { color: "success", icon: <IconCircleCheck size={15} /> },
  error: { color: "danger", icon: <IconCircleX size={15} /> },
  warning: { color: "warning", icon: <IconAlertTriangle size={15} /> },
  info: { color: "info", icon: <IconInfoCircle size={15} /> },
};

/** An inline action button in a toast. */
export interface ToastAction {
  label: ReactNode;
  onClick?: () => void;
  /** Render as the filled primary action (else a quiet secondary). */
  primary?: boolean;
}

export interface ToastOptions {
  title?: ReactNode;
  /** ms before auto-dismiss, or false to keep open. */
  autoClose?: number | false;
  /** Stable id — re-showing with the same id replaces the toast. */
  id?: string;
  /** Show a close (✕) button. Auto-on when `actions` are present. */
  withClose?: boolean;
  /** Inline action buttons rendered under the message. */
  actions?: ToastAction[];
}

function actionRow(actions: ToastAction[], id: string) {
  return (
    <Group gap="sm" mt={10} wrap="nowrap">
      {actions.map((action, index) => (
        <Button
          key={`${index}-${typeof action.label === "string" ? action.label : ""}`}
          tone={action.primary ? "primary" : "secondary"}
          size="xs"
          onClick={() => {
            action.onClick?.();
            notifications.hide(id);
          }}
        >
          {action.label}
        </Button>
      ))}
    </Group>
  );
}

function show(tone: ToastTone, message: ReactNode, options: ToastOptions = {}): string {
  const { color, icon } = TONE[tone];
  const hasActions = Boolean(options.actions?.length);
  const persistent = hasActions || options.autoClose === false;
  const id = options.id ?? crypto.randomUUID();
  const body =
    hasActions && options.actions ? (
      <div>
        {message}
        {actionRow(options.actions, id)}
      </div>
    ) : (
      message
    );

  notifications.show({
    id,
    color,
    icon,
    title: options.title,
    message: body,
    autoClose: persistent ? false : options.autoClose,
    withCloseButton: options.withClose ?? hasActions,
    classNames: persistent ? { ...styles, root: `${styles.root} ${styles.persistent}` } : styles,
  });
  return id;
}

// ── Progress toast ───────────────────────────────────────────────
export interface ProgressToastOptions {
  id?: string;
  /** 0–100 starting value. */
  value?: number;
  onCancel?: () => void;
}

export interface ProgressToastController {
  id: string;
  /** Update the percentage (and optionally the label). */
  update: (value: number, label?: ReactNode) => void;
  /** Finish as a success toast. */
  done: (message?: ReactNode) => void;
  /** Finish as an error toast. */
  fail: (message?: ReactNode) => void;
  hide: () => void;
}

function progressBody(value: number, label: ReactNode, onCancel: (() => void) | undefined, id: string) {
  const pct = Math.min(100, Math.max(0, Math.round(value)));
  return (
    <div className={styles.progress}>
      <div className={styles.progressTrack}>
        <div className={styles.progressFill} style={{ width: `${pct}%` }} />
      </div>
      <Group justify="space-between" wrap="nowrap" gap="sm">
        <Text size="sm" className={styles.progressLabel}>
          <span className={styles.progressPct}>{pct}%</span> {label}
        </Text>
        {onCancel && (
          <Button
            tone="ghost"
            size="xs"
            onClick={() => {
              onCancel();
              notifications.hide(id);
            }}
          >
            Cancel
          </Button>
        )}
      </Group>
    </div>
  );
}

function progress(label: ReactNode, options: ProgressToastOptions = {}): ProgressToastController {
  const id = options.id ?? crypto.randomUUID();
  const persistentClasses = { ...styles, root: `${styles.root} ${styles.persistent}` };
  const base = { id, autoClose: false as const, withCloseButton: false, classNames: persistentClasses };

  notifications.show({
    ...base,
    color: "primary",
    loading: true, // ECG loader spins while running
    message: progressBody(options.value ?? 0, label, options.onCancel, id),
  });

  return {
    id,
    update: (value, nextLabel) =>
      notifications.update({
        ...base,
        color: "primary",
        loading: true,
        message: progressBody(value, nextLabel ?? label, options.onCancel, id),
      }),
    done: (message) =>
      notifications.update({
        id,
        color: "success",
        icon: TONE.success.icon,
        loading: false,
        autoClose: 3500,
        withCloseButton: true,
        classNames: styles,
        message: message ?? "Done",
      }),
    fail: (message) =>
      notifications.update({
        id,
        color: "danger",
        icon: TONE.error.icon,
        loading: false,
        autoClose: 6000,
        withCloseButton: true,
        classNames: styles,
        message: message ?? "Failed",
      }),
    hide: () => notifications.hide(id),
  };
}

/**
 * Signature Spectrum toast — tone-typed notifications with the ECG glyph, an
 * auto-dismiss progress line, optional actions + close, and a determinate
 * progress variant. Prefer over raw `notifications.show({ color })`:
 *   toast.success("Saved");
 *   toast.error("Upload failed", { title: "Heads up", actions: [{ label: "Retry", primary: true, onClick }] });
 *   const p = toast.progress("Calculating…", { onCancel }); p.update(67); p.done("Complete");
 */
export const toast = {
  success: (message: ReactNode, options?: ToastOptions) => show("success", message, options),
  error: (message: ReactNode, options?: ToastOptions) => show("error", message, options),
  warning: (message: ReactNode, options?: ToastOptions) => show("warning", message, options),
  info: (message: ReactNode, options?: ToastOptions) => show("info", message, options),
  progress,
  hide: (id: string) => notifications.hide(id),
};
