import { Box, type BoxProps } from "@mantine/core";
import { type ComponentType, forwardRef, type SVGProps } from "react";
import CrabChibi from "@/assets/mascot/crab-chibi.svg?react";
import CrabChibiThink from "@/assets/mascot/crab-chibi-think.svg?react";
import CrabGeometric from "@/assets/mascot/crab-geometric.svg?react";
import CrabLine from "@/assets/mascot/crab-line.svg?react";
import CrabMedic from "@/assets/mascot/crab-medic.svg?react";
import styles from "./crab.module.scss";

/**
 * The MedBrains crab, one variant per place:
 * - `geometric`: small system spots (16–40px): help button, badges, toasts.
 * - `line`: dense clinical screens (empty states, hints) and print; mono.
 * - `medic`: anything patients see (portal, kiosk, waiting board).
 * - `chibi`: big moments (assistant hero, 404, success).
 */
export type CrabVariant = "geometric" | "line" | "medic" | "chibi";
export type CrabState = "idle" | "thinking" | "happy";

export interface CrabProps extends Omit<BoxProps, "children"> {
  variant?: CrabVariant;
  state?: CrabState;
  /** Rendered width and height in px. */
  size?: number;
  /** `onBrand` for a crab sitting on a blue fill (white body). */
  tone?: "default" | "onBrand";
  /** Announce the crab; it is decorative (hidden) when omitted. */
  label?: string;
}

type Art = ComponentType<SVGProps<SVGSVGElement>>;

const ART: Record<CrabVariant, Art> = {
  geometric: CrabGeometric,
  line: CrabLine,
  medic: CrabMedic,
  chibi: CrabChibi,
};

export const Crab = forwardRef<HTMLSpanElement, CrabProps>(function Crab(
  { variant = "geometric", state = "idle", size = 32, tone = "default", label, className, ...rest },
  ref,
) {
  const Svg = variant === "chibi" && state === "thinking" ? CrabChibiThink : ART[variant];
  return (
    <Box
      ref={ref}
      component="span"
      className={[styles.crab, styles[variant], styles[state], styles[tone], className]
        .filter(Boolean)
        .join(" ")}
      data-variant={variant}
      data-state={state}
      w={size}
      h={size}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      {...rest}
    >
      <Svg focusable="false" aria-hidden="true" />
    </Box>
  );
});
Crab.displayName = "Crab";
