/**
 * Shared module landing template. Each of the 11 staff modules
 * mounts a `ModuleHome` with a permission-gated action grid plus
 * optional summary tiles backed by a list endpoint.
 */

import type { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { Text } from "react-native-paper";
import {
  Badge,
  Card,
  COLORS,
  EcgLoader,
  Empty,
  SPACING,
} from "@medbrains/ui-mobile";
import type { IntentTone } from "@medbrains/ui-mobile";
import { useHasPermission } from "../lib/permissions.js";

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
        <Text
          variant="headlineMedium"
          style={{ color: COLORS.brand, marginTop: 4 }}
        >
          {title}
        </Text>
        {description && (
          <Text
            variant="bodyMedium"
            style={{ color: COLORS.ink, opacity: 0.75, marginTop: 4 }}
          >
            {description}
          </Text>
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
      {!loading &&
        actions.map((a) => <ActionRow key={a.id} action={a} />)}
    </ScrollView>
  );
}

function SummaryTile({ tile }: { tile: ModuleSummaryTile }) {
  return (
    <View style={{ minWidth: 140, flexGrow: 1 }}>
      <Card eyebrow={tile.eyebrow} title={String(tile.count)}>
        <Text variant="bodyMedium" style={{ color: COLORS.ink }}>
          {tile.title}
        </Text>
      </Card>
    </View>
  );
}

function ActionRow({ action }: { action: ModuleAction }) {
  const allowed = useHasPermission(action.permission ?? "");
  const visible = !action.permission || allowed;
  if (!visible) {
    return null;
  }
  return (
    <View
      style={{
        borderTopWidth: 1,
        borderTopColor: COLORS.rule,
        paddingVertical: SPACING.md,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
      }}
      onTouchEnd={action.onPress}
    >
      <View style={{ flex: 1, paddingRight: SPACING.md }}>
        <Text variant="titleSmall" style={{ color: COLORS.ink, fontWeight: "600" }}>
          {action.label}
        </Text>
        {action.description && (
          <Text
            variant="bodySmall"
            style={{ color: COLORS.brandDeep, opacity: 0.7, marginTop: 2 }}
          >
            {action.description}
          </Text>
        )}
      </View>
      {action.badge && (
        <Badge label={action.badge.label} tone={action.badge.tone} />
      )}
    </View>
  );
}
