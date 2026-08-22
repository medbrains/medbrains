import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { blue, ink, mint, rose, teal } from "@medbrains/design-system/tokens";
import { COLORS } from "../tokens.js";

/**
 * The app bar's wash, in Carbon steps rather than hand-mixed hexes.
 *
 * These were seven approximations of the ramp that had drifted off it —
 * `#EFEEFF` and `#D7D5FF` in the card were violet[0] and violet[1] exactly,
 * typed out by hand. Snapping them back is the point of having a token core
 * shared with the web: a ward board and a desktop screen should be the same
 * colour because they read the same value, not because somebody matched them
 * by eye once.
 */
const SOFT_STOPS = [
  // `navActiveBg` is blue[0]; listing both was a repeated stop that rendered as
  // one flat band twice as wide, not a gradient step.
  COLORS.navActiveBg,
  ink[1],
  blue[1],
  teal[0],
  mint[0],
  rose[0],
] as const;

const ACCENT_STOPS = [
  COLORS.accentGradientStart,
  blue[4],
  COLORS.accentGradientMid,
  teal[5],
  COLORS.accentGradientEnd,
] as const;

export function AppBarGradient(): ReactNode {
  return (
    <View pointerEvents="none" style={styles.root}>
      {/*
        Keyed by position, like the card's stops and for the same reason. A
        gradient stop has no identity beyond where it sits, and keying by the
        colour breaks the moment two steps of a ramp resolve to the same hex —
        which they do here, because `navActiveBg` *is* blue[0].
      */}
      <View style={styles.softRow}>
        {SOFT_STOPS.map((color, index) => (
          <View
            key={`soft-${index}-${color}`}
            style={[styles.stop, { backgroundColor: color }]}
          />
        ))}
      </View>
      <View style={styles.accentRow}>
        {ACCENT_STOPS.map((color, index) => (
          <View
            key={`accent-${index}-${color}`}
            style={[styles.stop, { backgroundColor: color }]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.navActiveBg,
  },
  softRow: {
    flex: 1,
    flexDirection: "row",
  },
  accentRow: {
    height: 3,
    flexDirection: "row",
  },
  stop: {
    flex: 1,
  },
});
