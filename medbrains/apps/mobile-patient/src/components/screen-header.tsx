/**
 * Sub-screen header with a back affordance. Used by drill-down
 * screens within a module to return to the module home.
 */

import { COLORS, SPACING } from "@medbrains/ui-mobile";
import type { ReactNode } from "react";
import { View } from "react-native";
import { Text, TouchableRipple } from "react-native-paper";
import { useModuleRouter } from "./module-router.js";

/** WCAG 2.2 SC 2.5.8 / the mobile surface rules: no target smaller than this. */
const MIN_TOUCH_TARGET = 44;

export interface ScreenHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  trailing?: ReactNode;
}

export function ScreenHeader({
  eyebrow,
  title,
  description,
  trailing,
}: ScreenHeaderProps): ReactNode {
  const router = useModuleRouter();
  return (
    <View
      style={{
        paddingHorizontal: SPACING.md,
        paddingTop: SPACING.md,
        paddingBottom: SPACING.sm,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.rule,
        backgroundColor: COLORS.canvas,
      }}
    >
      <View
        style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}
      >
        <View style={{ flex: 1, paddingRight: SPACING.sm }}>
          {/*
            The only way back from any drill-down screen. It was an 11px Text
            with onPress: not a button to a screen reader, and far under the
            44px target.
          */}
          <TouchableRipple
            onPress={router.pop}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={{ minHeight: MIN_TOUCH_TARGET, justifyContent: "center" }}
          >
            <Text
              variant="labelSmall"
              style={{
                color: COLORS.brandDeep,
                letterSpacing: 1.4,
                textTransform: "uppercase",
                fontFamily: "JetBrainsMono-Regular",
              }}
            >
              {eyebrow ? `← ${eyebrow}` : "← BACK"}
            </Text>
          </TouchableRipple>
          <Text variant="headlineSmall" style={{ color: COLORS.brand, marginTop: 4 }}>
            {title}
          </Text>
          {description && (
            <Text variant="bodySmall" style={{ color: COLORS.ink, opacity: 0.7, marginTop: 2 }}>
              {description}
            </Text>
          )}
        </View>
        {trailing}
      </View>
    </View>
  );
}
