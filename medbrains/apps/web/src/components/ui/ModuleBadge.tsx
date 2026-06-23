import { Box, type BoxProps } from "@mantine/core";
import type { CSSProperties } from "react";
import styles from "./module-badge.module.scss";

export interface ModuleBadgeProps extends BoxProps {
  /** 2–3 letter module mark, e.g. "Pt". */
  abbr: string;
  /** Adobe-style per-module identity colour (hex or CSS colour). */
  color: string;
  /** Square size in px (matches the nav icon it replaces). */
  size?: number;
  /** Accessible title — usually the full module name. */
  title?: string;
}

/**
 * Adobe-style module badge — a rounded colour square with a short mono mark.
 * A compact, instantly-recognisable identity for a module in the nav rail or
 * tabs. The identity colour is passed in (lives in a config map), so the
 * component stays token-driven and reusable across modules.
 */
export function ModuleBadge({ abbr, color, size = 20, title, ...rest }: ModuleBadgeProps) {
  // Shrink the glyph for 3-letter marks (OPD, ICU…) so they fit the square.
  const fontScale = abbr.length >= 3 ? 0.34 : 0.46;
  return (
    <Box
      className={styles.badge}
      style={
        {
          "--badge-color": color,
          "--badge-size": `${size}px`,
          "--badge-font-scale": fontScale,
        } as CSSProperties
      }
      title={title}
      aria-hidden
      {...rest}
    >
      {abbr}
    </Box>
  );
}
ModuleBadge.displayName = "ModuleBadge";
