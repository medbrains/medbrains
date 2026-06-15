import { Alert as MantineAlert, type AlertProps as MantineAlertProps } from "@mantine/core";

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

/** Inline notice — light tinted surface, semantic tone, theme radius. */
export function Alert({ tone = "info", variant = "light", ...rest }: AlertProps) {
  return <MantineAlert color={TONE_COLOR[tone]} variant={variant} {...rest} />;
}
