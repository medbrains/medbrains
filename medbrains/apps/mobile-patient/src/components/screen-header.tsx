/**
 * Sub-screen header with a back affordance. Used by drill-down
 * screens within a module to return to the module home.
 */

import type { ReactNode } from "react";
import { View } from "react-native";
import { Text } from "react-native-paper";
import { COLORS, SPACING } from "@medbrains/ui-mobile";
import { useModuleRouter } from "./module-router.js";

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
          <Text
            variant="labelSmall"
            style={{
              color: COLORS.brandDeep,
              letterSpacing: 1.4,
              textTransform: "uppercase",
              fontFamily: "JetBrainsMono-Regular",
            }}
            onPress={router.pop}
          >
            {eyebrow ? `← ${eyebrow}` : "← BACK"}
          </Text>
          <Text variant="headlineSmall" style={{ color: COLORS.brand, marginTop: 4 }}>
            {title}
          </Text>
          {description && (
            <Text
              variant="bodySmall"
              style={{ color: COLORS.ink, opacity: 0.7, marginTop: 2 }}
            >
              {description}
            </Text>
          )}
        </View>
        {trailing}
      </View>
    </View>
  );
}
