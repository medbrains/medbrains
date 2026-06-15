import { type DrawerProps, Drawer as MantineDrawer } from "@mantine/core";

/**
 * Standard drawer — slides in from the right, for work done *alongside*
 * the page (order basket, detail/edit panels). Right by default so it
 * doesn't fight the left navigation; pass `position` to override.
 */
export function Drawer({ position = "right", padding = "lg", overlayProps, ...rest }: DrawerProps) {
  return (
    <MantineDrawer
      position={position}
      padding={padding}
      overlayProps={{ backgroundOpacity: 0.55, blur: 3, ...overlayProps }}
      {...rest}
    />
  );
}
