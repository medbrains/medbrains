import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { useLocation } from "react-router";

interface Props {
  children: ReactNode;
}

// easeOutExpo — a graceful decelerate so the incoming screen settles into place.
const SETTLE = [0.16, 1, 0.3, 1] as const;

/**
 * Route-change transition for the main content area. Enter-only: when the
 * pathname changes the frame remounts and the new screen fades + settles up into
 * place. We deliberately drop AnimatePresence's exit/`mode="wait"` — waiting for
 * an exit before mounting the next (often data-heavy) route added a gap, a
 * skeleton flash, and stutter while the new page rendered. Animating only the
 * entrance, with transform+opacity (compositor-cheap, no blur), is smoother.
 *
 * Honours `prefers-reduced-motion` (WCAG): plain, fast opacity fade, no movement.
 */
export function PageTransition({ children }: Props) {
  const location = useLocation();
  const reduce = useReducedMotion();

  return (
    <motion.div
      key={location.pathname}
      className="page-content"
      style={
        reduce ? undefined : { transformOrigin: "center top", willChange: "transform, opacity" }
      }
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={
        reduce ? { duration: 0.12 } : { duration: 0.3, ease: SETTLE, opacity: { duration: 0.2 } }
      }
    >
      {children}
    </motion.div>
  );
}
