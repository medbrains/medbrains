import {
  MultiSelect as MantineMultiSelect,
  type MultiSelectProps as MantineMultiSelectProps,
} from "@mantine/core";
import { forwardRef } from "react";

export type MultiSelectProps = MantineMultiSelectProps;

/** Standard multi-select — bordered, sm, with a check on chosen items. */
export const MultiSelect = forwardRef<HTMLInputElement, MultiSelectProps>(function MultiSelect(
  { size = "sm", checkIconPosition = "right", ...rest },
  ref,
) {
  return (
    <MantineMultiSelect ref={ref} size={size} checkIconPosition={checkIconPosition} {...rest} />
  );
});
MultiSelect.displayName = "MultiSelect";
