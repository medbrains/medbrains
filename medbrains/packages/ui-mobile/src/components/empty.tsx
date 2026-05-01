/**
 * Empty-state component — used wherever a list/queue/section has no
 * items. Quiet visual; never a copper accent.
 */

import type { ReactNode } from "react";
import { View } from "react-native";
import { Button, Text } from "react-native-paper";
import { COLORS, SPACING } from "../tokens.js";

export interface EmptyProps {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function Empty({ title, description, actionLabel, onAction }: EmptyProps): ReactNode {
  return (
    <View style={{ padding: SPACING.lg, alignItems: "center" }}>
      <Text
        variant="titleMedium"
        style={{ color: COLORS.ink, marginBottom: SPACING.xs, textAlign: "center" }}
      >
        {title}
      </Text>
      {description && (
        <Text
          variant="bodyMedium"
          style={{
            color: COLORS.brandDeep,
            opacity: 0.75,
            textAlign: "center",
            marginBottom: SPACING.md,
          }}
        >
          {description}
        </Text>
      )}
      {actionLabel && onAction && (
        <Button mode="outlined" onPress={onAction}>
          {actionLabel}
        </Button>
      )}
    </View>
  );
}
