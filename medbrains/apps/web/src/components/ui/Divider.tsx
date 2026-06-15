import { type DividerProps, Divider as MantineDivider } from "@mantine/core";

/**
 * Standard hairline divider — always the theme rule colour, never heavier.
 * Pass `label` for a labelled separator.
 */
export function Divider({ color = "var(--mb-border)", ...rest }: DividerProps) {
  return <MantineDivider color={color} {...rest} />;
}
