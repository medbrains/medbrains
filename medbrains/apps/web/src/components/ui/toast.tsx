import { notifications } from "@mantine/notifications";
import {
  IconAlertTriangle,
  IconCircleCheck,
  IconExclamationCircle,
  IconInfoCircle,
} from "@tabler/icons-react";
import type { ReactNode } from "react";
import styles from "./toast.module.scss";

type ToastTone = "success" | "error" | "warning" | "info";

const TONE: Record<ToastTone, { color: string; icon: ReactNode }> = {
  success: { color: "success", icon: <IconCircleCheck size={18} /> },
  error: { color: "danger", icon: <IconExclamationCircle size={18} /> },
  warning: { color: "warning", icon: <IconAlertTriangle size={18} /> },
  info: { color: "info", icon: <IconInfoCircle size={18} /> },
};

export interface ToastOptions {
  title?: ReactNode;
  /** ms before auto-dismiss, or false to keep open. */
  autoClose?: number | false;
  /** Stable id — re-showing with the same id replaces the toast. */
  id?: string;
}

function show(tone: ToastTone, message: ReactNode, options: ToastOptions = {}) {
  const { color, icon } = TONE[tone];
  notifications.show({
    color,
    icon,
    message,
    title: options.title,
    autoClose: options.autoClose,
    id: options.id,
    classNames: styles,
  });
}

/**
 * Signature Spectrum toast — distinctive, tone-typed notifications with an
 * icon + accent. Prefer over raw `notifications.show({ color })`:
 *   toast.success("Saved"); toast.error("Failed", { title: "Heads up" });
 */
export const toast = {
  success: (message: ReactNode, options?: ToastOptions) => show("success", message, options),
  error: (message: ReactNode, options?: ToastOptions) => show("error", message, options),
  warning: (message: ReactNode, options?: ToastOptions) => show("warning", message, options),
  info: (message: ReactNode, options?: ToastOptions) => show("info", message, options),
};
