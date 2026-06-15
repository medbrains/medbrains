import { ActionIcon, type ActionIconProps, type ElementProps } from "@mantine/core";
import { forwardRef } from "react";

/**
 * Icon-only button tones — the ActionIcon counterpart to Button. Icon
 * buttons are quiet by default (subtle), so tones tint rather than fill.
 * An `aria-label` is required: an icon alone has no accessible name.
 */
export type IconButtonTone = "default" | "primary" | "danger" | "success";

const TONE_PROPS: Record<IconButtonTone, Pick<ActionIconProps, "variant" | "color">> = {
  default: { variant: "subtle", color: "gray" },
  primary: { variant: "subtle", color: "primary" },
  danger: { variant: "subtle", color: "danger" },
  success: { variant: "subtle", color: "success" },
};

export interface IconButtonProps
  extends Omit<ActionIconProps, "variant" | "color">,
    ElementProps<"button", keyof ActionIconProps> {
  tone?: IconButtonTone;
  /** Required — an icon button has no visible text to name it. */
  "aria-label": string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { tone = "default", ...rest },
  ref,
) {
  return <ActionIcon ref={ref} {...TONE_PROPS[tone]} {...rest} />;
});
IconButton.displayName = "IconButton";
