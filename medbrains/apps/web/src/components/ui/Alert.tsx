import { Alert as MantineAlert, type AlertProps as MantineAlertProps } from "@mantine/core";
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

export interface AlertProps extends Omit<MantineAlertProps, "color"> {
  tone?: AlertTone;
}

/**
 * Inline notice — Signature Spectrum console style: a bold tone accent bar
 * on the left, hairline border, squared corners and a faint tone sheen.
 */
export function Alert({ tone = "info", variant = "light", className, ...rest }: AlertProps) {
  return (
    <MantineAlert
      color={TONE_COLOR[tone]}
      variant={variant}
      className={className ? `${styles.alert} ${className}` : styles.alert}
      {...rest}
    />
  );
}
