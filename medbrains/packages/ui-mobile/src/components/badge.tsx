/**
 * MedBrains badge — small pill for status, counts, intents. Accent
 * variant is reserved for changed values, unread counts, and "new
 * since last visit" indicators.
 */

import type { ReactNode } from "react";
import { View } from "react-native";
import { Text } from "react-native-paper";
import { INTENT_BG, INTENT_FG, RADIUS } from "../tokens.js";
import type { IntentTone } from "../tokens.js";

export interface BadgeProps {
  label: string;
  tone?: IntentTone;
  monospace?: boolean;
}

export function Badge({ label, tone = "neutral", monospace = false }: BadgeProps): ReactNode {
  return (
    <View
      style={{
        backgroundColor: INTENT_BG[tone],
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: RADIUS.sm,
        alignSelf: "flex-start",
      }}
    >
      <Text
        variant="labelSmall"
        style={{
          color: INTENT_FG[tone],
          fontWeight: "600",
          fontFamily: monospace ? "JetBrainsMono-Regular" : undefined,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
