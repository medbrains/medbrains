import { Button as MantineButton, type ButtonProps as MantineButtonProps } from "@mantine/core";
import { type ElementType, forwardRef } from "react";

/**
 * Carbon button variants, mapped to Mantine once so the standard lives in one
 * place. Carbon hierarchy: primary (one per screen) > secondary (paired
 * negative action) > tertiary (outline, independent) > ghost (least prominent).
 * Danger has three styles — primary / tertiary / ghost. Per Carbon, button
 * labels are LEFT-aligned and any icon sits to the RIGHT (see `justify` below);
 * icon-only buttons (which require a tooltip) use `IconButton`, and danger is
 * never icon-only.
 */
export type ButtonTone =
  | "primary"
  | "secondary"
  | "tertiary"
  | "ghost"
  | "danger"
  | "danger-tertiary"
  | "danger-ghost"
  /** @deprecated alias of `danger-ghost`. */
  | "subtle-danger";

const TONE_PROPS: Record<ButtonTone, Pick<MantineButtonProps, "variant" | "color">> = {
  primary: { variant: "filled", color: "primary" },
  secondary: { variant: "default" },
  // Carbon tertiary — outline button (brand border, transparent fill).
  tertiary: { variant: "outline", color: "primary" },
  ghost: { variant: "subtle", color: "gray" },
  danger: { variant: "filled", color: "danger" },
  "danger-tertiary": { variant: "outline", color: "danger" },
  "danger-ghost": { variant: "subtle", color: "danger" },
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
  title?: string;
  /** Polymorphic render — e.g. `component="a"` or `component={Link}` for link buttons. */
  component?: ElementType;
  href?: string;
  target?: string;
  rel?: string;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { tone = "secondary", size = "sm", justify = "flex-start", ...rest },
  ref,
) {
  // Carbon: labels are left-aligned; an icon (rightSection) sits to the right.
  // `justify="flex-start"` is a no-op for hug-width buttons and gives the
  // correct left alignment for full/fixed-width ones.
  // Cast keeps the public ButtonProps polymorphic (component/href) while
  // satisfying Mantine's overloaded factory typing; props forward at runtime.
  return (
    <MantineButton
      ref={ref}
      size={size}
      justify={justify}
      {...TONE_PROPS[tone]}
      {...(rest as MantineButtonProps)}
    />
  );
});
Button.displayName = "Button";
