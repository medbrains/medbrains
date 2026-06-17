import { Alert as MantineAlert, type AlertProps as MantineAlertProps } from "@mantine/core";
import {
  IconAlertTriangle,
  IconCircleCheck,
  IconCircleX,
  IconInfoCircle,
} from "@tabler/icons-react";
import type { ReactNode } from "react";
import styles from "./alert.module.scss";

/** Semantic alert tones — the only colours an inline alert should use. */
export type AlertTone = "info" | "success" | "warning" | "danger" | "neutral";

const TONE_COLOR: Record<AlertTone, string> = {
  info: "info",
  success: "success",
  warning: "warning",
  danger: "danger",
  neutral: "gray",
};

/** Default tone glyph — shown white inside the solid tone icon circle. */
const TONE_ICON: Record<AlertTone, ReactNode> = {
  info: <IconInfoCircle size={15} />,
  success: <IconCircleCheck size={15} />,
  warning: <IconAlertTriangle size={15} />,
  danger: <IconCircleX size={15} />,
  neutral: <IconInfoCircle size={15} />,
};

export interface AlertProps extends Omit<MantineAlertProps, "color"> {
  tone?: AlertTone;
}

/**
 * Inline notice — Signature Spectrum console style: a tone icon in a soft
 * tinted badge, a bold tone accent rail, hairline border, near-white card.
 */
export function Alert({ tone = "info", variant = "light", className, icon, ...rest }: AlertProps) {
  return (
    <MantineAlert
      color={TONE_COLOR[tone]}
      variant={variant}
      icon={icon ?? TONE_ICON[tone]}
      className={className ? `${styles.alert} ${className}` : styles.alert}
      {...rest}
    />
  );
}
