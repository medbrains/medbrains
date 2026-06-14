import { Badge as MantineBadge, type BadgeProps as MantineBadgeProps } from "@mantine/core";
import { forwardRef, type ReactNode } from "react";

/** Semantic status tones — the only colours a status chip should use. */
export type BadgeTone =
  | "neutral"
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "accent";

const TONE_COLOR: Record<BadgeTone, string> = {
  neutral: "gray",
  primary: "primary",
  success: "success",
  warning: "warning",
  danger: "danger",
  info: "info",
  accent: "cinnabar",
};

export interface BadgeProps extends Omit<MantineBadgeProps, "color"> {
  tone?: BadgeTone;
  children?: ReactNode;
}

/** Clean squared status pill (no leading dot / forced mono). */
export const Badge = forwardRef<HTMLDivElement, BadgeProps>(function Badge(
  { tone = "neutral", variant = "light", size = "sm", ...rest },
  ref,
) {
  return (
    <MantineBadge ref={ref} color={TONE_COLOR[tone]} variant={variant} size={size} {...rest} />
  );
});
