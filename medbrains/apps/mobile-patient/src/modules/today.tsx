/**
 * Health → Today.
 *
 * One number, one sentence, then the doses. That order is deliberate: a person
 * opening this at 7am wants to know whether they are on track and what is
 * left, not to read a dashboard. Everything else is a tap away.
 *
 * The number is adherence and the sentence is a verdict from a closed set —
 * see `daily-brief.ts` for why that set is closed rather than generated.
 */

import type { Module } from "@medbrains/mobile-shell";
import { Badge, Card, COLORS, EcgLoader, Empty, SPACING } from "@medbrains/ui-mobile";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { FlatList, View } from "react-native";
import { Text } from "react-native-paper";
import type { Confidence, DoseSlot } from "../health/daily-brief.js";
import { buildDailyBrief } from "../health/daily-brief.js";
import { loadLocalRecord } from "../health/local-source.js";
import { useFetch } from "../lib/use-fetch.js";

/** What the confidence chip says, in words rather than a number nobody can act on. */
const CONFIDENCE_LABEL: Readonly<Record<Confidence, string>> = {
  calibrating: "Still learning",
  building: "Building a baseline",
  established: "Established",
};

function DoseRow({ slot }: { slot: DoseSlot }): ReactNode {
  const done = slot.status === "taken";
  return (
    <View style={{ paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm }}>
      <Card tone={done ? "success" : "neutral"}>
        <View
          style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
        >
          <Text variant="titleMedium" style={{ color: COLORS.ink, flex: 1 }}>
            {slot.name}
          </Text>
          <Badge
            label={done ? "taken" : slot.status === "due" ? slot.time : slot.status}
            tone={done ? "success" : "neutral"}
          />
        </View>
        {slot.instructions.length > 0 && (
          <Text variant="bodySmall" style={{ color: COLORS.ink, opacity: 0.7 }}>
            {slot.instructions}
          </Text>
        )}
      </Card>
    </View>
  );
}

function TodayScreen(): ReactNode {
  const { data, loading, error } = useFetch(loadLocalRecord, []);

  /** Recomputed only when the record changes — the clock is read once per load. */
  const brief = useMemo(() => (data ? buildDailyBrief(data, new Date()) : null), [data]);

  if (loading) {
    return <EcgLoader />;
  }
  if (error !== null || brief === null) {
    // A local read that fails is the one case where an empty state is honest:
    // it is this person's own file, and it claims nothing about their health.
    return <Empty title="Nothing to show yet" description="Add a medication to get started." />;
  }

  return (
    <FlatList
      data={brief.slots}
      keyExtractor={(slot) => `${slot.planId}@${slot.scheduledFor}`}
      renderItem={({ item }) => <DoseRow slot={item} />}
      ListHeaderComponent={
        <View style={{ padding: SPACING.md }}>
          <Text variant="displaySmall" style={{ color: COLORS.brand }}>
            {brief.adherencePercent === null ? "—" : `${brief.adherencePercent}%`}
          </Text>
          <Text variant="labelSmall" style={{ color: COLORS.ink, opacity: 0.7 }}>
            TAKEN THIS WEEK
          </Text>
          <Text variant="bodyLarge" style={{ color: COLORS.ink, marginTop: SPACING.sm }}>
            {brief.verdict}
          </Text>
          <View style={{ flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.sm }}>
            <Badge label={CONFIDENCE_LABEL[brief.confidence]} tone="info" />
            {brief.streakDays > 0 && (
              <Badge label={`${brief.streakDays}-day streak`} tone="success" />
            )}
          </View>
        </View>
      }
      ListEmptyComponent={
        <Empty
          title="Nothing scheduled today"
          description="Medications you add will appear here at their times."
        />
      }
    />
  );
}

export const todayModule: Module = {
  id: "today",
  displayName: "Today",
  icon: () => null,
  navigator: TodayScreen,
  requiredPermissions: [],
  appCodes: ["Mobile-Patient"],
  tags: ["patient", "health", "companion"],
};
