/**
 * TV-shaped display surface — large type, high contrast, no touch
 * interactions (D-pad / focus only). Each TV module mounts a
 * `<TvBoard>` as its landing.
 *
 * Real WebSocket-driven data wiring follows in a per-module phase;
 * this scaffold ships the visual shell so the Android TV box has
 * the right boot screen per deep-link.
 */

import type { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { Text } from "react-native-paper";
import { COLORS, SPACING } from "@medbrains/ui-mobile";

export interface TvBoardProps {
  eyebrow: string;
  title: string;
  subtitle?: string;
  legend?: string;
  children?: ReactNode;
}

export function TvBoard({
  eyebrow,
  title,
  subtitle,
  legend,
  children,
}: TvBoardProps): ReactNode {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: COLORS.brandDeep }}
      contentContainerStyle={{ padding: SPACING.lg, minHeight: "100%" }}
    >
      <View style={{ marginBottom: SPACING.lg }}>
        <Text
          style={{
            color: COLORS.emerald,
            letterSpacing: 4,
            textTransform: "uppercase",
            fontFamily: "JetBrainsMono-Regular",
            fontSize: 22,
          }}
        >
          {eyebrow}
        </Text>
        <Text
          style={{
            color: COLORS.canvas,
            fontSize: 56,
            fontFamily: "Fraunces-Regular",
            marginTop: SPACING.sm,
          }}
        >
          {title}
        </Text>
        {subtitle && (
          <Text
            style={{
              color: COLORS.tint,
              fontSize: 24,
              marginTop: SPACING.sm,
              opacity: 0.85,
            }}
          >
            {subtitle}
          </Text>
        )}
      </View>
      {children}
      {legend && (
        <View style={{ marginTop: SPACING.xl }}>
          <Text
            style={{
              color: COLORS.tint,
              fontSize: 18,
              opacity: 0.65,
              fontFamily: "JetBrainsMono-Regular",
            }}
          >
            {legend}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

export function TvSummaryRow({
  items,
}: {
  items: ReadonlyArray<{ label: string; value: string }>;
}): ReactNode {
  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        gap: SPACING.lg,
        marginBottom: SPACING.lg,
      }}
    >
      {items.map((it) => (
        <View
          key={it.label}
          style={{
            backgroundColor: COLORS.brand,
            padding: SPACING.lg,
            borderRadius: 12,
            minWidth: 220,
            flexGrow: 1,
            borderWidth: 2,
            borderColor: COLORS.brandDeep,
          }}
        >
          <Text
            style={{
              color: COLORS.emerald,
              fontFamily: "JetBrainsMono-Regular",
              fontSize: 16,
              letterSpacing: 2.5,
              textTransform: "uppercase",
            }}
          >
            {it.label}
          </Text>
          <Text
            style={{
              color: COLORS.canvas,
              fontSize: 56,
              fontFamily: "Fraunces-Regular",
              marginTop: SPACING.xs,
            }}
          >
            {it.value}
          </Text>
        </View>
      ))}
    </View>
  );
}
