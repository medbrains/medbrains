/**
 * Common card row used by every entity list. Title + sub-meta +
 * optional badge. Tap-able when `onPress` provided.
 */

import type { IntentTone } from "@medbrains/ui-mobile";
import { Badge, COLORS, SPACING } from "@medbrains/ui-mobile";
import type { ReactNode } from "react";
import { View } from "react-native";
import { Text, TouchableRipple } from "react-native-paper";

/** WCAG 2.2 SC 2.5.8 / the mobile surface rules: no target smaller than this. */
const MIN_TOUCH_TARGET = 44;

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
  const card = (
    <View
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

  if (!onPress) {
    return card;
  }

  // A tappable row has to announce itself as a button and give feedback. The
  // plain View this replaced did neither, so a patient using VoiceOver could
  // not open their own bill or report.
  return (
    <TouchableRipple
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      style={{ borderRadius: 8, minHeight: MIN_TOUCH_TARGET }}
    >
      {card}
    </TouchableRipple>
  );
}
