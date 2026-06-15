import {
  SegmentedControl as MantineSegmentedControl,
  type SegmentedControlProps,
} from "@mantine/core";

/**
 * Standard segmented control — sm, theme radius. For switching between a
 * small fixed set of views inline (2–4 options); use Tabs for page-level
 * sections.
 */
export function SegmentedControl({ size = "sm", ...rest }: SegmentedControlProps) {
  return <MantineSegmentedControl size={size} {...rest} />;
}
