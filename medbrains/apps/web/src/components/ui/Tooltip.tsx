import { Tooltip as MantineTooltip, type TooltipProps } from "@mantine/core";

/**
 * Standard tooltip — small open delay (no flicker on pass-through) and a
 * pointer arrow, consistent everywhere. A tooltip is a hint, never the
 * only place information lives.
 */
export function Tooltip({ openDelay = 350, withArrow = true, ...rest }: TooltipProps) {
  return <MantineTooltip openDelay={openDelay} withArrow={withArrow} {...rest} />;
}
