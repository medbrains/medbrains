import { Select as MantineSelect, type SelectProps as MantineSelectProps } from "@mantine/core";
import { forwardRef } from "react";

export type SelectProps = MantineSelectProps;

/** Standard single-select — bordered, sm, with a check on the chosen item. */
export const Select = forwardRef<HTMLInputElement, SelectProps>(function Select(
  { size = "sm", checkIconPosition = "right", ...rest },
  ref,
) {
  return <MantineSelect ref={ref} size={size} checkIconPosition={checkIconPosition} {...rest} />;
});
Select.displayName = "Select";
