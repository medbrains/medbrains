import { Card as MantineCard, type CardProps as MantineCardProps } from "@mantine/core";
import { forwardRef, type ReactNode } from "react";

export interface CardProps extends MantineCardProps {
  children?: ReactNode;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
}

/**
 * Our standard surface: border-first, no resting shadow, squared.
 * (Mantine theme already defaults to this; the wrapper gives a stable
 * import surface and one place to evolve the surface treatment.)
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { withBorder = true, padding = "md", ...rest },
  ref,
) {
  return <MantineCard ref={ref} withBorder={withBorder} padding={padding} {...rest} />;
});
