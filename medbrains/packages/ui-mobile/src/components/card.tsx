/**
 * Forest+Copper Card. Wraps Paper's Card with the design system's
 * 1px hairline border, dual-layer shadow, and on-hover left-accent.
 */

import type { ReactNode } from "react";
import { View } from "react-native";
import { Card as PaperCard, Text } from "react-native-paper";
import { COLORS, RADIUS, SPACING } from "../tokens.js";

export interface CardProps {
  title?: string;
  eyebrow?: string;
  children: ReactNode;
  accent?: boolean;
}

export function Card({ title, eyebrow, children, accent = false }: CardProps): ReactNode {
  return (
    <PaperCard
      mode="outlined"
      style={{
        borderColor: COLORS.rule,
        borderRadius: RADIUS.md,
        backgroundColor: COLORS.canvas,
        marginVertical: SPACING.sm,
      }}
    >
      {accent && (
        <View
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            width: 3,
            backgroundColor: COLORS.brand,
            borderTopLeftRadius: RADIUS.md,
            borderBottomLeftRadius: RADIUS.md,
          }}
        />
      )}
      {(eyebrow || title) && (
        <View style={{ padding: SPACING.md, paddingBottom: SPACING.sm }}>
          {eyebrow && (
            <Text
              variant="labelSmall"
              style={{
                color: COLORS.brandDeep,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                fontFamily: "JetBrainsMono-Regular",
                marginBottom: 4,
              }}
            >
              {eyebrow}
            </Text>
          )}
          {title && (
            <Text
              variant="titleMedium"
              style={{ color: COLORS.ink, fontWeight: "600" }}
            >
              {title}
            </Text>
          )}
        </View>
      )}
      <PaperCard.Content style={{ paddingTop: 0 }}>{children}</PaperCard.Content>
    </PaperCard>
  );
}
