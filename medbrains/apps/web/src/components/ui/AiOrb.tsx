import { Box, type BoxProps } from "@mantine/core";
import { IconActivityHeartbeat, IconCheck } from "@tabler/icons-react";
import { forwardRef } from "react";
import styles from "./ai-orb.module.scss";

/**
 * The AI orb, drawn with CSS from theme tokens (blue → brand purple), one
 * variant per place:
 * - `halo`: AI inside clinical work (Ask AI buttons, suggestion chips); calmest.
 * - `glass`: the assistant chat (header and avatar).
 * - `blob`: voice, while dictating or listening.
 * - `pulse`: AI reading vitals, ECG and risk scores.
 */
export type AiOrbVariant = "halo" | "glass" | "blob" | "pulse";
export type AiOrbState = "idle" | "thinking" | "listening" | "loading" | "done";

export interface AiOrbProps extends Omit<BoxProps, "children"> {
  variant?: AiOrbVariant;
  state?: AiOrbState;
  /** Rendered width and height in px. */
  size?: number;
  /** Announce the orb; it is decorative (hidden) when omitted. */
  label?: string;
}

export const AiOrb = forwardRef<HTMLSpanElement, AiOrbProps>(function AiOrb(
  { variant = "glass", state = "idle", size = 24, label, className, ...rest },
  ref,
) {
  const glyph = Math.max(10, Math.round(size * 0.5));
  return (
    <Box
      ref={ref}
      component="span"
      className={[styles.orb, styles[variant], styles[state], className].filter(Boolean).join(" ")}
      data-variant={variant}
      data-state={state}
      w={size}
      h={size}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      {...rest}
    >
      <Box component="span" className={styles.core} />
      {variant === "pulse" && state !== "done" && (
        <>
          <IconActivityHeartbeat className={styles.glyph} size={glyph} stroke={2} />
          <Box component="span" className={styles.live} />
        </>
      )}
      {state === "done" && <IconCheck className={styles.glyph} size={glyph} stroke={3} />}
    </Box>
  );
});
AiOrb.displayName = "AiOrb";
