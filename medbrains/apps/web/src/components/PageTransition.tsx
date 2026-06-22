import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { useLocation } from "react-router";

interface Props {
  children: ReactNode;
}

// easeOutExpo — a strong, graceful decelerate so the incoming screen *settles*
// into place rather than just appearing. The signature feel of the transition.
const SETTLE = [0.16, 1, 0.3, 1] as const;

/**
 * Route-change transition for the main content area. The incoming screen rises
 * and settles into focus — a small upward slide + a barely-there scale-up + fade,
 * eased so it decelerates gently into place (340ms). The outgoing screen leaves
 * quickly (160ms) so navigation never feels sluggish. Calm and console-like, on
 * brand — not a flashy slideshow. Transform + opacity only (compositor-cheap, no
 * blur), so it stays smooth on modest hospital workstations.
 *
 * Honours `prefers-reduced-motion` (WCAG): collapses to a plain, fast opacity
 * fade with no movement.
 */
export function PageTransition({ children }: Props) {
  const location = useLocation();
  const reduce = useReducedMotion();

  if (reduce) {
    return (
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={location.pathname}
          className="page-content"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.14 }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        className="page-content"
        style={{ transformOrigin: "center top", willChange: "transform, opacity" }}
        initial={{ opacity: 0, y: 14, scale: 0.985 }}
        animate={{
          opacity: 1,
          y: 0,
          scale: 1,
          // Fade a touch faster than the move so content reads, then settles.
          transition: { duration: 0.34, ease: SETTLE, opacity: { duration: 0.22 } },
        }}
        exit={{
          opacity: 0,
          y: -8,
          scale: 0.992,
          transition: { duration: 0.16, ease: "easeIn" },
        }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
