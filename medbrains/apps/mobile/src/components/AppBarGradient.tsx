import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

const SOFT_STOPS = [
  "#ccfbf1",
  "#cffcf2",
  "#d4fbf4",
  "#d9faf6",
  "#ddf8f8",
  "#e0f2fe",
  "#e5f4fb",
  "#eaf6f4",
  "#eff7ee",
  "#f5f7e8",
  "#ffedd5",
] as const;

const ACCENT_STOPS = ["#14b8a6", "#12b7ae", "#0ea5e9", "#38bdf8", "#fbbf24", "#f59e0b"] as const;

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
    backgroundColor: "#ccfbf1",
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
