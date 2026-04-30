/**
 * Common card row used by every entity list. Title + sub-meta +
 * optional badge. Tap-able when `onPress` provided.
 */

import type { ReactNode } from "react";
import { View } from "react-native";
import { Text } from "react-native-paper";
import { Badge, COLORS, SPACING } from "@medbrains/ui-mobile";
import type { IntentTone } from "@medbrains/ui-mobile";

export interface EntityRowProps {
  title: string;
  subtitle?: string;
  badge?: { label: string; tone?: IntentTone };
  accent?: boolean;
  onPress?: () => void;
}

export function EntityRow({
  title,
  subtitle,
  badge,
  accent = false,
  onPress,
}: EntityRowProps): ReactNode {
  return (
    <View
      onTouchEnd={onPress}
      style={{
        backgroundColor: COLORS.canvas,
        borderWidth: 1,
        borderColor: accent ? COLORS.copper : COLORS.rule,
        padding: SPACING.md,
        borderRadius: 8,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <View style={{ flex: 1, paddingRight: SPACING.sm }}>
        <Text variant="titleMedium" style={{ color: COLORS.ink, fontWeight: "600" }}>
          {title}
        </Text>
        {subtitle && (
          <Text
            variant="bodySmall"
            style={{
              color: COLORS.brandDeep,
              opacity: 0.7,
              fontFamily: "JetBrainsMono-Regular",
              marginTop: 2,
            }}
          >
            {subtitle}
          </Text>
        )}
      </View>
      {badge && <Badge label={badge.label} tone={badge.tone} />}
    </View>
  );
}
