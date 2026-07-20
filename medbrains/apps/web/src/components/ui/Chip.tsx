import { Chip as MantineChip, type ChipProps as MantineChipProps } from "@mantine/core";
import { forwardRef } from "react";

export type ChipProps = MantineChipProps;

/** Selectable chip — theme-coloured, sm. Wrap in `ChipGroup` for multi-select. */
export const Chip = forwardRef<HTMLInputElement, ChipProps>(function Chip(
  { size = "sm", ...rest },
  ref,
) {
  return <MantineChip ref={ref} size={size} {...rest} />;
});
Chip.displayName = "Chip";

/** Groups chips into a single- or multi-select set (`multiple`, `value`, `onChange`). */
export const ChipGroup = MantineChip.Group;
