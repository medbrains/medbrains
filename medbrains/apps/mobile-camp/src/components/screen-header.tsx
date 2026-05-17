/**
 * Sub-screen header with a back affordance. Used by drill-down
 * screens within a module to return to the module home.
 */

import { COLORS, EcgLoader, SPACING } from "@medbrains/ui-mobile";
import type { ReactNode } from "react";
import { View } from "react-native";
import { Text } from "react-native-paper";
import { useModuleRouter } from "./module-router.js";

export interface ScreenHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  trailing?: ReactNode;
  loadingLabel?: string;
}

export function ScreenHeader({
  eyebrow,
  title,
  description,
  trailing,
  loadingLabel,
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
            <Text variant="bodySmall" style={{ color: COLORS.ink, opacity: 0.7, marginTop: 2 }}>
              {description}
            </Text>
          )}
        </View>
        {trailing}
      </View>
      {loadingLabel && (
        <View
          style={{
            marginTop: SPACING.sm,
            borderWidth: 1,
            borderColor: COLORS.rule,
            borderRadius: 8,
            backgroundColor: COLORS.navActiveBg,
            paddingHorizontal: SPACING.sm,
            paddingVertical: SPACING.xs,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: SPACING.sm }}>
            <EcgLoader width={130} />
            <Text variant="labelMedium" style={{ color: COLORS.brandDeep }}>
              {loadingLabel}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}
