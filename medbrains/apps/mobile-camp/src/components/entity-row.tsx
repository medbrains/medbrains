/**
 * Common card row used by every entity list. Title + sub-meta +
 * optional badge. Tap-able when `onPress` provided.
 */

import type { IntentTone } from "@medbrains/ui-mobile";
import { Badge, COLORS, SPACING } from "@medbrains/ui-mobile";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { Text } from "react-native-paper";

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
    <Pressable
      accessibilityLabel={title}
      accessibilityRole={onPress ? "button" : "text"}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: pressed ? COLORS.panel : COLORS.canvas,
        borderWidth: 1,
        borderColor: accent ? COLORS.copper : pressed ? COLORS.brand : COLORS.rule,
        padding: SPACING.md,
        borderRadius: 8,
        minHeight: 76,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        shadowColor: COLORS.brandDeep,
        shadowOpacity: pressed ? 0.05 : 0.025,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
      })}
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
    </Pressable>
  );
}
