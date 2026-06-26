import { motion, useReducedMotion } from "motion/react";
import { type ReactNode, useEffect, useState } from "react";
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
 *
 * IMPORTANT — fixed/sticky positioning: a `transform` or `will-change: transform`
 * on this wrapper makes it the containing block for every descendant's
 * `position: fixed`, so fixed bars/modals would anchor here instead of the
 * viewport. We therefore animate transform ONLY during the entrance and, once it
 * settles, drop `transform`/`will-change` entirely (transform: none) so fixed and
 * sticky elements inside any page resolve against the viewport as expected.
 */
export function PageTransition({ children }: Props) {
  const location = useLocation();
  const reduce = useReducedMotion();
  const [settled, setSettled] = useState(false);

  // New route → animate again (and re-create the containing block briefly).
  useEffect(() => {
    setSettled(false);
  }, [location.pathname]);

  const settledStyle = { transform: "none", willChange: "auto" } as const;
  const animatingStyle = {
    transformOrigin: "center top",
    willChange: "transform, opacity",
  } as const;

  return (
    <motion.div
      key={location.pathname}
      className="page-content"
      style={reduce || settled ? settledStyle : animatingStyle}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={
        reduce ? { duration: 0.12 } : { duration: 0.3, ease: SETTLE, opacity: { duration: 0.2 } }
      }
      onAnimationComplete={() => setSettled(true)}
    >
      {children}
    </motion.div>
  );
}
