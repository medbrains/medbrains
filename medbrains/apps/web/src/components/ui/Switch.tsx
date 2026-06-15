import { Switch as MantineSwitch, type SwitchProps } from "@mantine/core";
import { forwardRef } from "react";

/** Standard toggle — sm by default, theme colours. */
export const Switch = forwardRef<HTMLInputElement, SwitchProps>(function Switch(
  { size = "sm", ...rest },
  ref,
) {
  return <MantineSwitch ref={ref} size={size} {...rest} />;
});
Switch.displayName = "Switch";
