import { notifications } from "@mantine/notifications";
import type { ReactNode } from "react";
import { EcgGlyph } from "./EcgGlyph";
import styles from "./toast.module.scss";

type ToastTone = "success" | "error" | "warning" | "info";

// One signature ECG glyph for every toast — the tone is carried by colour
// (Mantine tints the icon chip per `color`), the brand by the heartbeat.
const TONE: Record<ToastTone, { color: string; icon: ReactNode }> = {
  success: { color: "success", icon: <EcgGlyph /> },
  error: { color: "danger", icon: <EcgGlyph /> },
  warning: { color: "warning", icon: <EcgGlyph /> },
  info: { color: "info", icon: <EcgGlyph /> },
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
