import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { MEDBRAINS_COLORS } from "../theme/paper-theme";

const SOFT_STOPS = [
  MEDBRAINS_COLORS.navActiveBg,
  "#F4F8FD",
  MEDBRAINS_COLORS.panel,
  MEDBRAINS_COLORS.navActiveBgEnd,
  "#EEF8F5",
  "#E3FAF2",
  MEDBRAINS_COLORS.accentMuted,
] as const;

const ACCENT_STOPS = [
  MEDBRAINS_COLORS.brand,
  "#1A7CFF",
  MEDBRAINS_COLORS.vital,
  MEDBRAINS_COLORS.emerald,
  MEDBRAINS_COLORS.copper,
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
    backgroundColor: MEDBRAINS_COLORS.navActiveBg,
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
