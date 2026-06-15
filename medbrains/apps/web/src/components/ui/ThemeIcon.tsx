import { ThemeIcon as MantineThemeIcon, type ThemeIconProps } from "@mantine/core";
import { forwardRef } from "react";

/** Decorative icon tile tones — light tint by default, semantic colour. */
export type ThemeIconTone = "neutral" | "primary" | "success" | "warning" | "danger" | "info";

const TONE_COLOR: Record<ThemeIconTone, string> = {
  neutral: "gray",
  primary: "primary",
  success: "success",
  warning: "warning",
  danger: "danger",
  info: "info",
};

export interface ThemeIconProps2 extends Omit<ThemeIconProps, "color"> {
  tone?: ThemeIconTone;
}

/** Standard icon tile — soft tinted square, theme radius. Decorative only. */
export const ThemeIcon = forwardRef<HTMLDivElement, ThemeIconProps2>(function ThemeIcon(
  { tone = "neutral", variant = "light", ...rest },
  ref,
) {
  return <MantineThemeIcon ref={ref} color={TONE_COLOR[tone]} variant={variant} {...rest} />;
});
ThemeIcon.displayName = "ThemeIcon";

export type { ThemeIconProps2 as ThemeIconProps };
