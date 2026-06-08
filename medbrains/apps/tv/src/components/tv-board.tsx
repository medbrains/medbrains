/**
 * TV-shaped display surface — large type, high contrast, no touch
 * interactions (D-pad / focus only). Each TV module mounts a
 * `<TvBoard>` as its landing.
 *
 * Real WebSocket-driven data wiring follows in a per-module phase;
 * this scaffold ships the visual shell so the Android TV box has
 * the right boot screen per deep-link.
 */

import type { IntentTone } from "@medbrains/ui-mobile";
import { Badge, COLORS, INTENT_BG, INTENT_FG, SPACING } from "@medbrains/ui-mobile";
import type { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { Text } from "react-native-paper";
import { TV_TEXT, tvText } from "./tv-i18n.js";

export interface TvReadinessItem {
  label: string;
  tone?: IntentTone;
  value: string;
}

export interface TvBoardProps {
  eyebrow: string;
  title: string;
  subtitle?: string;
  legend?: string;
  privacyNotice?: string;
  readiness?: ReadonlyArray<TvReadinessItem>;
  tags?: ReadonlyArray<string>;
  children?: ReactNode;
}

export function TvBoard({
  eyebrow,
  title,
  subtitle,
  legend,
  privacyNotice,
  readiness = [],
  tags = [],
  children,
}: TvBoardProps): ReactNode {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: COLORS.brandDeep }}
      contentContainerStyle={{ padding: SPACING.lg, minHeight: "100%" }}
    >
      <View style={{ marginBottom: SPACING.lg }}>
        <Text
          style={{
            color: COLORS.emerald,
            letterSpacing: 4,
            textTransform: "uppercase",
            fontFamily: "JetBrainsMono-Regular",
            fontSize: 22,
          }}
        >
          {eyebrow}
        </Text>
        <Text
          style={{
            color: COLORS.canvas,
            fontSize: 56,
            fontFamily: "Fraunces-Regular",
            marginTop: SPACING.sm,
          }}
        >
          {title}
        </Text>
        {subtitle && (
          <Text
            style={{
              color: COLORS.tint,
              fontSize: 24,
              marginTop: SPACING.sm,
              opacity: 0.85,
            }}
          >
            {subtitle}
          </Text>
        )}
        {tags.length > 0 && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: SPACING.md }}>
            {tags.map((tag) => (
              <Badge key={tag} label={tag} tone="info" />
            ))}
          </View>
        )}
        {readiness.length > 0 && <TvReadinessStrip items={readiness} />}
      </View>
      {privacyNotice && <TvPrivacyNotice label={privacyNotice} />}
      {children}
      {legend && (
        <View style={{ marginTop: SPACING.xl }}>
          <Text
            style={{
              color: COLORS.tint,
              fontSize: 18,
              opacity: 0.65,
              fontFamily: "JetBrainsMono-Regular",
            }}
          >
            {legend}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

function TvReadinessStrip({ items }: { items: ReadonlyArray<TvReadinessItem> }): ReactNode {
  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        gap: SPACING.sm,
        marginTop: SPACING.md,
      }}
    >
      {items.map((item) => {
        const tone = item.tone ?? "neutral";
        return (
          <View
            key={`${item.label}-${item.value}`}
            style={{
              backgroundColor: INTENT_BG[tone],
              borderColor: INTENT_FG[tone],
              borderRadius: 8,
              borderWidth: 1,
              minWidth: 150,
              paddingHorizontal: SPACING.md,
              paddingVertical: SPACING.sm,
            }}
          >
            <Text
              style={{
                color: INTENT_FG[tone],
                fontFamily: "JetBrainsMono-Regular",
                fontSize: 12,
                letterSpacing: 1.5,
                textTransform: "uppercase",
              }}
            >
              {item.label}
            </Text>
            <Text
              style={{
                color: INTENT_FG[tone],
                fontFamily: "JetBrainsMono-Regular",
                fontSize: 20,
                marginTop: 2,
                textTransform: "uppercase",
              }}
            >
              {item.value}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function TvPrivacyNotice({ label }: { label: string }): ReactNode {
  return (
    <View
      style={{
        backgroundColor: "rgba(28, 183, 133, 0.16)",
        borderColor: COLORS.emerald,
        borderRadius: 10,
        borderWidth: 2,
        marginBottom: SPACING.lg,
        padding: SPACING.md,
      }}
    >
      <Text
        style={{
          color: COLORS.emerald,
          fontFamily: "JetBrainsMono-Regular",
          fontSize: 16,
          letterSpacing: 2,
          textTransform: "uppercase",
        }}
      >
        {tvText(TV_TEXT.privacy.displayMode)}
      </Text>
      <Text
        style={{
          color: COLORS.canvas,
          fontSize: 22,
          marginTop: SPACING.xs,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

export function TvSummaryRow({
  items,
}: {
  items: ReadonlyArray<{ label: string; value: string }>;
}): ReactNode {
  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        gap: SPACING.lg,
        marginBottom: SPACING.lg,
      }}
    >
      {items.map((it) => (
        <View
          key={it.label}
          style={{
            backgroundColor: COLORS.brand,
            padding: SPACING.lg,
            borderRadius: 12,
            minWidth: 220,
            flexGrow: 1,
            borderWidth: 2,
            borderColor: COLORS.brandDeep,
          }}
        >
          <Text
            style={{
              color: COLORS.emerald,
              fontFamily: "JetBrainsMono-Regular",
              fontSize: 16,
              letterSpacing: 2.5,
              textTransform: "uppercase",
            }}
          >
            {it.label}
          </Text>
          <Text
            style={{
              color: COLORS.canvas,
              fontSize: 56,
              fontFamily: "Fraunces-Regular",
              marginTop: SPACING.xs,
            }}
          >
            {it.value}
          </Text>
        </View>
      ))}
    </View>
  );
}
