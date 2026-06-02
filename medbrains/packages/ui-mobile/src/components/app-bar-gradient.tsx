import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { COLORS } from "../tokens.js";

const SOFT_STOPS = [
  COLORS.navActiveBg,
  "#F4F8FD",
  "#F8F8F7",
  "#E6F1FF",
  "#EEF8F5",
  "#E3FAF2",
  "#FDE9E6",
] as const;

const ACCENT_STOPS = [
  COLORS.accentGradientStart,
  "#1A7CFF",
  COLORS.accentGradientMid,
  "#1CB785",
  COLORS.accentGradientEnd,
] as const;

export function AppBarGradient(): ReactNode {
  return (
    <View pointerEvents="none" style={styles.root}>
      <View style={styles.softRow}>
        {SOFT_STOPS.map((color) => (
          <View key={color} style={[styles.stop, { backgroundColor: color }]} />
        ))}
      </View>
      <View style={styles.accentRow}>
        {ACCENT_STOPS.map((color) => (
          <View key={color} style={[styles.stop, { backgroundColor: color }]} />
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
