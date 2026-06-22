import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { useLocation } from "react-router";

interface Props {
  children: ReactNode;
}

/**
 * Subtle route-change transition for the main content area. A short fade + a few
 * px of vertical slide as one screen swaps for the next — calm and console-like,
 * not flashy. Keyed by pathname so each route mounts its own animated frame.
 *
 * Honours `prefers-reduced-motion` (WCAG): movement is dropped to a plain
 * opacity fade for users who ask for reduced motion.
 */
export function PageTransition({ children }: Props) {
  const location = useLocation();
  const reduce = useReducedMotion();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        className="page-content"
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
        transition={{ duration: reduce ? 0.12 : 0.18, ease: "easeOut" }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
