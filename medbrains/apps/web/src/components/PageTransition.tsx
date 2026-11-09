import { Box } from "@mantine/core";
import type { ReactNode } from "react";
import { useLocation } from "react-router";

interface Props {
  children: ReactNode;
}

/**
 * Route-change transition for the main content area. Keyed on the pathname so
 * the frame remounts and replays `.page-content`'s CSS `pageEnter` entrance
 * (global.scss: opacity + 8px settle, 200ms). The animation has no fill mode,
 * so once it ends no `transform` is left on the wrapper and descendants'
 * `position: fixed` resolves against the viewport. The global
 * `prefers-reduced-motion` rule shortens it to nothing.
 *
 * Plain CSS replaced `motion/react` here (2026-11-09): this was its only use,
 * and it put ~115 kB of animation library on every first page.
 */
export function PageTransition({ children }: Props) {
  const { pathname } = useLocation();
  return (
    <Box key={pathname} className="page-content">
      {children}
    </Box>
  );
}
