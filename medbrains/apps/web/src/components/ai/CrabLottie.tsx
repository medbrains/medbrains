import { useReducedMotion } from "@mantine/hooks";
import Lottie from "lottie-react";
import animationData from "@/assets/crab-lottie.json";
import { CrabMascot } from "./CrabMascot";

export interface CrabLottieProps {
  size?: number;
  loop?: boolean;
  "aria-label"?: string;
}

/**
 * Fully-animated brain-crab (breathe · claw wave · blink · leg scuttle) for hero
 * / empty-state / loading moments — the richer companion to the lightweight
 * per-message avatar `CrabMascot`. Honours prefers-reduced-motion by falling
 * back to the static mascot.
 */
export function CrabLottie({
  size = 120,
  loop = true,
  "aria-label": ariaLabel = "MedBrains assistant",
}: CrabLottieProps) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return <CrabMascot size={size} pose="greet" animate={false} aria-label={ariaLabel} />;
  }

  return (
    <Lottie
      animationData={animationData}
      loop={loop}
      autoplay
      style={{ width: size, height: size }}
      aria-label={ariaLabel}
      role="img"
    />
  );
}
