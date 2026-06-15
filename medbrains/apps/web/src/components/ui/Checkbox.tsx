import { type CheckboxProps, Checkbox as MantineCheckbox } from "@mantine/core";
import { forwardRef } from "react";

/** Standard checkbox — sm, theme primary colour. */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { size = "sm", ...rest },
  ref,
) {
  return <MantineCheckbox ref={ref} size={size} {...rest} />;
});
Checkbox.displayName = "Checkbox";
