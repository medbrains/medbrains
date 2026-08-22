/**
 * MedBrains Card. Wraps Paper's Card with the design system's
 * 1px hairline border, dual-layer shadow, and on-hover left-accent.
 */

import type { ReactNode } from "react";
import { View } from "react-native";
import { Card as PaperCard, Text } from "react-native-paper";
import { mint, rose, sky, violet } from "@medbrains/design-system/tokens";
import { COLORS, RADIUS, SPACING } from "../tokens.js";
import type { IntentTone } from "../tokens.js";

export type CardPattern =
  | "plain"
  | "clinical"
  | "aqua"
  | "sky"
  | "copper"
  | "violet"
  | "success"
  | "alert";

export interface CardProps {
  title?: string;
  eyebrow?: string;
  children: ReactNode;
  accent?: boolean;
  tone?: IntentTone;
  pattern?: CardPattern;
}

export function Card({
  title,
  eyebrow,
  children,
  accent = false,
  tone = "neutral",
  pattern,
}: CardProps): ReactNode {
  const resolvedPattern = pattern ?? patternForTone(tone, accent);
  const patternStyle = CARD_PATTERNS[resolvedPattern];

  return (
    <PaperCard
      mode="outlined"
      style={{
        borderColor: COLORS.rule,
        borderRadius: RADIUS.md,
        backgroundColor: patternStyle.background,
        marginVertical: SPACING.sm,
        overflow: "hidden",
      }}
    >
      {resolvedPattern !== "plain" && <PatternLayer pattern={patternStyle} />}
      {accent && (
        <View
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            width: 3,
            backgroundColor: patternStyle.accent,
            borderTopLeftRadius: RADIUS.md,
            borderBottomLeftRadius: RADIUS.md,
            zIndex: 2,
          }}
        />
      )}
      {(eyebrow || title) && (
        <View style={{ padding: SPACING.md, paddingBottom: SPACING.sm, zIndex: 1 }}>
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
              style={{ color: COLORS.ink, fontWeight: "700" }}
            >
              {title}
            </Text>
          )}
        </View>
      )}
      <PaperCard.Content style={{ paddingTop: 0, zIndex: 1 }}>{children}</PaperCard.Content>
    </PaperCard>
  );
}

interface CardPatternStyle {
  background: string;
  accent: string;
  stops: readonly string[];
}

const CARD_PATTERNS: Record<CardPattern, CardPatternStyle> = {
  plain: {
    background: COLORS.canvas,
    accent: COLORS.brand,
    stops: [],
  },
  clinical: {
    background: COLORS.canvas,
    accent: COLORS.brand,
    stops: [COLORS.navActiveBg, COLORS.tint, COLORS.panel],
  },
  aqua: {
    background: COLORS.canvas,
    accent: COLORS.brand,
    stops: [COLORS.navActiveBg, COLORS.tint, COLORS.panel],
  },
  sky: {
    background: COLORS.canvas,
    accent: COLORS.brand,
    stops: [sky[0], COLORS.tint, COLORS.navActiveBg],
  },
  copper: {
    background: COLORS.canvas,
    accent: COLORS.copper,
    stops: [COLORS.accentMuted, rose[1], COLORS.navActiveBg],
  },
  violet: {
    background: COLORS.canvas,
    accent: violet[5],
    stops: [violet[0], violet[1], COLORS.tint],
  },
  success: {
    background: COLORS.canvas,
    accent: COLORS.emerald,
    stops: [mint[0], mint[1], COLORS.navActiveBg],
  },
  alert: {
    background: COLORS.canvas,
    accent: COLORS.red,
    stops: [rose[0], rose[1], COLORS.accentMuted],
  },
};

function patternForTone(tone: IntentTone, accent: boolean): CardPattern {
  if (accent || tone === "copper" || tone === "warn") return "copper";
  if (tone === "success") return "success";
  if (tone === "info") return "sky";
  if (tone === "alert") return "alert";
  return "clinical";
}

function PatternLayer({ pattern }: { pattern: CardPatternStyle }): ReactNode {
  return (
    <View
      pointerEvents="none"
      style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
    >
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 4,
          flexDirection: "row",
        }}
      >
        {/*
          Keyed by position, not by colour. Several palette tokens resolve to
          the same hex — `navActiveBg`, `tint` and `navChildActiveBg` are all
          blue[0] — so a gradient that uses two of them handed React two
          children with the same key, and every module home in the app logged
          the warning twice. A gradient stop has no identity beyond where it
          sits, so its position is the honest key.
        */}
        {pattern.stops.map((color, index) => (
          <View
            key={`${index}-${color}`}
            style={{ flex: 1, backgroundColor: color }}
          />
        ))}
      </View>
      <View
        style={{
          position: "absolute",
          top: 12,
          right: -18,
          width: 90,
          bottom: 0,
          flexDirection: "row",
          opacity: 0.32,
        }}
      >
        {pattern.stops.map((color, index) => (
          <View
            key={`${index}-${color}`}
            style={{
              flex: 1,
              backgroundColor: color,
              marginLeft: 3,
              borderTopLeftRadius: 999,
            }}
          />
        ))}
      </View>
    </View>
  );
}
