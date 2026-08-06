/**
 * Shared module landing template. Each of the 11 staff modules
 * mounts a `ModuleHome` with a permission-gated action grid plus
 * optional summary tiles backed by a list endpoint.
 */

import type { IntentTone } from "@medbrains/ui-mobile";
import { Badge, Card, COLORS, EcgLoader, Empty, SPACING } from "@medbrains/ui-mobile";
import type { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { List, Text } from "react-native-paper";
import { useHasPermission } from "../lib/permissions.js";

/** WCAG 2.2 SC 2.5.8 / the mobile surface rules: no target smaller than this. */
const MIN_TOUCH_TARGET = 44;

export interface ModuleAction {
  id: string;
  label: string;
  description?: string;
  permission?: string;
  onPress?: () => void;
  badge?: { label: string; tone?: IntentTone };
}

export interface ModuleSummaryTile {
  eyebrow: string;
  title: string;
  count: number | string;
  tone?: IntentTone;
}

export interface ModuleHomeProps {
  eyebrow: string;
  title: string;
  description?: string;
  tags?: ReadonlyArray<string>;
  loading?: boolean;
  summaries?: ReadonlyArray<ModuleSummaryTile>;
  actions: ReadonlyArray<ModuleAction>;
  emptyTitle?: string;
}

export function ModuleHome(props: ModuleHomeProps): ReactNode {
  const {
    eyebrow,
    title,
    description,
    tags = [],
    loading = false,
    summaries = [],
    actions,
    emptyTitle = "No actions available",
  } = props;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: COLORS.canvas }}
      contentContainerStyle={{ padding: SPACING.md }}
    >
      <View style={{ marginBottom: SPACING.md }}>
        <Text
          variant="labelSmall"
          style={{
            color: COLORS.brandDeep,
            letterSpacing: 1.5,
            textTransform: "uppercase",
            fontFamily: "JetBrainsMono-Regular",
          }}
        >
          {eyebrow}
        </Text>
        <Text variant="headlineMedium" style={{ color: COLORS.brand, marginTop: 4 }}>
          {title}
        </Text>
        {description && (
          <Text variant="bodyMedium" style={{ color: COLORS.ink, opacity: 0.75, marginTop: 4 }}>
            {description}
          </Text>
        )}
        {tags.length > 0 && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: SPACING.sm }}>
            {tags.map((tag) => (
              <Badge key={tag} label={tag} tone="info" />
            ))}
          </View>
        )}
      </View>
      {loading && (
        <View style={{ alignItems: "center", paddingVertical: SPACING.lg }}>
          <EcgLoader />
        </View>
      )}
      {!loading && summaries.length > 0 && (
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: SPACING.sm,
            marginBottom: SPACING.md,
          }}
        >
          {summaries.map((s) => (
            <SummaryTile key={s.eyebrow} tile={s} />
          ))}
        </View>
      )}
      {!loading && actions.length === 0 && <Empty title={emptyTitle} />}
      {!loading && actions.map((a) => <ActionRow key={a.id} action={a} />)}
    </ScrollView>
  );
}

const summaryPatterns = ["aqua", "sky", "copper", "violet"] as const;

function SummaryTile({ tile }: { tile: ModuleSummaryTile }) {
  const pattern = summaryPatterns[Math.abs(hashKey(tile.eyebrow)) % summaryPatterns.length];

  return (
    <View style={{ minWidth: 140, flexGrow: 1 }}>
      <Card eyebrow={tile.eyebrow} title={String(tile.count)} pattern={pattern}>
        <Text variant="bodyMedium" style={{ color: COLORS.ink }}>
          {tile.title}
        </Text>
      </Card>
    </View>
  );
}

function hashKey(value: string): number {
  return Array.from(value).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
}

/**
 * A row a nurse or guard can actually operate.
 *
 * This was a plain `View` with `onTouchEnd`, which meant three things at once:
 * a screen-reader user could not activate any action in the app, a tap gave no
 * feedback and fired even if the finger slid off the row, and an action with no
 * handler looked exactly like one that worked. A guard tapping "Log new
 * incident" — the most time-critical thing they do — got silence and no way to
 * tell whether they had missed the row or the app was broken.
 *
 * `List.Item` is Paper's own row (already used in apps/mobile), so it carries
 * the button role, the ripple and the disabled semantics for free.
 */
function ActionRow({ action }: { action: ModuleAction }) {
  const allowed = useHasPermission(action.permission ?? "");
  const visible = !action.permission || allowed;
  if (!visible) {
    return null;
  }

  // Permitted but unbuilt. Say so rather than absorbing the tap in silence.
  const isUnavailable = !action.onPress;
  const description = isUnavailable
    ? [action.description, "Not available on mobile yet."].filter(Boolean).join(" ")
    : action.description;

  return (
    <List.Item
      title={action.label}
      description={description}
      onPress={action.onPress}
      disabled={isUnavailable}
      accessibilityRole="button"
      accessibilityState={{ disabled: isUnavailable }}
      style={{
        borderTopWidth: 1,
        borderTopColor: COLORS.rule,
        minHeight: MIN_TOUCH_TARGET,
        paddingVertical: SPACING.sm,
        opacity: isUnavailable ? 0.55 : 1,
      }}
      titleStyle={{ color: COLORS.ink, fontWeight: "600" }}
      descriptionStyle={{ color: COLORS.brandDeep, opacity: 0.7 }}
      descriptionNumberOfLines={3}
      right={() => <ActionRowBadge action={action} isUnavailable={isUnavailable} />}
    />
  );
}

function ActionRowBadge({
  action,
  isUnavailable,
}: {
  action: ModuleAction;
  isUnavailable: boolean;
}) {
  if (action.badge) {
    return (
      <View style={{ justifyContent: "center" }}>
        <Badge label={action.badge.label} tone={action.badge.tone} />
      </View>
    );
  }
  if (isUnavailable) {
    return (
      <View style={{ justifyContent: "center" }}>
        <Badge label="Not on mobile" tone="neutral" />
      </View>
    );
  }
  return null;
}
