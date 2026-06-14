import { Button as MantineButton, type ButtonProps as MantineButtonProps } from "@mantine/core";
import { forwardRef } from "react";

/**
 * Our canonical button tones. They map to Mantine variants/colours so
 * the Experian standard (gradient primary, neutral secondary, quiet
 * ghost) lives in one place instead of being re-decided per call site.
 */
export type ButtonTone = "primary" | "secondary" | "ghost" | "danger" | "subtle-danger";

const TONE_PROPS: Record<ButtonTone, Pick<MantineButtonProps, "variant" | "color">> = {
  primary: { variant: "filled", color: "primary" },
  secondary: { variant: "default" },
  ghost: { variant: "subtle", color: "gray" },
  danger: { variant: "filled", color: "danger" },
  "subtle-danger": { variant: "light", color: "danger" },
};

export interface ButtonProps extends Omit<MantineButtonProps, "variant" | "color"> {
  /** Visual intent — defaults to a neutral secondary button. */
  tone?: ButtonTone;
  type?: "button" | "submit" | "reset";
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  form?: string;
  name?: string;
  value?: string;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { tone = "secondary", size = "sm", ...rest },
  ref,
) {
  return <MantineButton ref={ref} size={size} {...TONE_PROPS[tone]} {...rest} />;
});
