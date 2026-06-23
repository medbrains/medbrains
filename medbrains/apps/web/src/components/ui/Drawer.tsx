import { type DrawerProps, Drawer as MantineDrawer } from "@mantine/core";

/**
 * Standard drawer — slides in from the right, for work done *alongside*
 * the page (order basket, detail/edit panels). Right by default so it
 * doesn't fight the left navigation; pass `position` to override.
 *
 * Accessibility (WCAG 2.1 AA): `title` names the dialog (Mantine wires
 * `aria-labelledby`); the close "X" gets a default `aria-label`; focus is
 * trapped and returns to the trigger; Esc closes. Always pass a `title`.
 */
export function Drawer({
  position = "right",
  padding = "lg",
  overlayProps,
  closeButtonProps,
  ...rest
}: DrawerProps) {
  return (
    <MantineDrawer
      position={position}
      padding={padding}
      overlayProps={{ backgroundOpacity: 0.55, blur: 3, ...overlayProps }}
      closeButtonProps={{ "aria-label": "Close", ...closeButtonProps }}
      {...rest}
    />
  );
}
