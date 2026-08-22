/**
 * What changes between a phone, a tablet and a wall, and what does not.
 *
 * `tokens.ts` carries the brand — the Carbon ramps, shared with the web so a
 * ward board and a desktop screen are the same green. This file carries the
 * things that are *not* shared, and the reason it exists is that they were
 * being hard-coded per screen instead.
 *
 * `const TAP_TARGET = 44` had been written into five separate screens by the
 * time anybody noticed. That is not a duplicated constant, it is a design
 * decision with no owner: nobody can raise the tablet's target size, because
 * there is no one place where it is decided. Worse, 44 is the *phone* number —
 * a tablet is held further away and a TV is read from three metres, and both
 * were inheriting a thumb-on-a-phone measurement.
 *
 * Per `docs/DEVICE-SURFACE-DESIGN-RULES.md`: the right design system per
 * surface, with Carbon as the brand layered on. Never a per-surface fork of
 * the palette; always a per-surface scale of the geometry.
 */

import { OVERSCAN, SPACING } from "./tokens.js";

export type Surface = "phone" | "tablet" | "tv";

export interface SurfaceScale {
  /**
   * Minimum hit target.
   *
   * Phone is WCAG 2.2 SC 2.5.8's floor of 44. A tablet is held at arm's length
   * and usually two-handed, so it gets more, not the same. A TV is not touched
   * at all — the number is the focus ring's minimum size, which has to read
   * across a room.
   */
  tapTarget: number;
  /** Multiplier on `SPACING`. Distance from the eye buys air, not density. */
  spacing: number;
  /** Multiplier on body type. */
  typeScale: number;
  /**
   * Safe area to keep content out of.
   *
   * Zero on handhelds. On a TV it is the overscan the panel eats, which is not
   * a style choice — content inside it is physically cut off on real hardware.
   */
  inset: { horizontal: number; vertical: number };
  /** Whether a pointer exists at all. Drives focus handling, not layout. */
  pointer: "touch" | "remote";
}

export const SURFACE_SCALE: Record<Surface, SurfaceScale> = {
  phone: {
    tapTarget: 44,
    spacing: 1,
    typeScale: 1,
    inset: { horizontal: 0, vertical: 0 },
    pointer: "touch",
  },
  tablet: {
    // Held further away and usually with two hands; 48 is Material 3's floor
    // and the right one for a surface that is not a thumb on a phone.
    tapTarget: 48,
    spacing: 1.5,
    typeScale: 1.15,
    inset: { horizontal: 0, vertical: 0 },
    pointer: "touch",
  },
  tv: {
    // Not a touch target: the minimum size a focus ring has to be to be seen
    // from three metres. Nothing on a TV is pressed with a finger.
    tapTarget: 64,
    spacing: 2,
    typeScale: 1.6,
    inset: OVERSCAN,
    pointer: "remote",
  },
};

/** Spacing for a surface: `space("tv", "md")` rather than a bare number. */
export function space(surface: Surface, step: keyof typeof SPACING): number {
  return Math.round(SPACING[step] * SURFACE_SCALE[surface].spacing);
}

/** Type size for a surface, from a phone-relative base. */
export function type(surface: Surface, base: number): number {
  return Math.round(base * SURFACE_SCALE[surface].typeScale);
}

/**
 * The one place a minimum target is decided.
 *
 * Every screen that hard-codes 44 should call this instead, so raising the
 * tablet's floor is one edit rather than a search.
 */
export function tapTarget(surface: Surface): number {
  return SURFACE_SCALE[surface].tapTarget;
}
