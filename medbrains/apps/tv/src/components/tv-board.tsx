/**
 * TV-shaped display surface — large type, high contrast, no touch
 * interactions (D-pad / focus only). Each TV module mounts a
 * `<TvBoard>` as its landing.
 *
 * A board does not scroll. Nobody is holding a remote to a waiting-room
 * screen, so anything below the fold is simply never seen; the content fills
 * the overscan-safe area and stops there.
 *
 * It also carries only what the room needs to read. Deep-link URIs, sync
 * timestamps and app-inventory tags are operator detail and have no business
 * on a screen patients are looking at.
 *
 * Status follows the same rule: a healthy board shows none, because "REFRESH
 * 5S" tells a waiting patient nothing and costs the space the tokens need. A
 * degraded or offline feed does show, prominently — a board quietly displaying
 * stale numbers is worse than one admitting it is stale.
 */

import type { IntentTone } from "@medbrains/ui-mobile";
import { COLORS, INTENT_BG, INTENT_FG, OVERSCAN, SPACING } from "@medbrains/ui-mobile";
import type { ReactNode } from "react";
import { View } from "react-native";
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
  privacyNotice?: string;
  readiness?: ReadonlyArray<TvReadinessItem>;
  children?: ReactNode;
}

export function TvBoard({
  eyebrow,
  title,
  subtitle,
  privacyNotice,
  readiness = [],
  children,
}: TvBoardProps): ReactNode {
  // Only what is wrong. Healthy status is operator detail.
  const problems = readiness.filter((item) => item.tone === "alert" || item.tone === "warn");

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: COLORS.brandDeep,
        paddingHorizontal: OVERSCAN.horizontal,
        paddingVertical: OVERSCAN.vertical,
      }}
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
        {problems.length > 0 && <TvReadinessStrip items={problems} />}
      </View>
      {privacyNotice && <TvPrivacyNotice label={privacyNotice} />}
      {/* Takes the rest of the screen, so a board fills it rather than
          spilling past the bottom edge. */}
      <View style={{ flex: 1 }}>{children}</View>
    </View>
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

/**
 * One line, not a block. The notice has to be present — a public display
 * showing patient data must say what it withholds — but it is reassurance,
 * not the content, and as a block it took a third of the screen from the
 * tokens.
 */
function TvPrivacyNotice({ label }: { label: string }): ReactNode {
  return (
    <Text
      numberOfLines={1}
      style={{
        color: COLORS.emerald,
        fontFamily: "JetBrainsMono-Regular",
        fontSize: 16,
        letterSpacing: 1.5,
        marginBottom: SPACING.md,
        opacity: 0.9,
        textTransform: "uppercase",
      }}
    >
      {`${tvText(TV_TEXT.privacy.displayMode)} \u00b7 ${label}`}
    </Text>
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
