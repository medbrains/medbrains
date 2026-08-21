/**
 * Nurse → the ward's open calls, on the phone that can answer them.
 *
 * The wall board says a bed is calling; this is where a nurse takes it. Two
 * acts, and they are not the same one: **Seen** records that a human has the
 * call, **Done** records that they went. The server keeps the waiting clock on
 * `created_at` through both, so acknowledging never quiets the board — a call
 * seen eleven minutes ago and not answered is the one that most needs
 * escalating, and a screen that went calm at "Seen" would hide exactly that.
 *
 * Unlike the TV, this screen shows the patient's own note. A phone is held by
 * one person; a nursing station is a corridor with a screen in it.
 *
 * FlatList with a fixed row height and a bounded page, per
 * `docs/DEVICE-CONSTRAINED-RULES.md`. A ward's calls are unbounded over a
 * shift; the list is not.
 */

import type { ActiveNurseCall, NurseCallEscalation } from "@medbrains/types";
import { nurseCallWaitParts, overdueNurseCalls } from "@medbrains/types";
import { Badge, COLORS, EcgLoader, Empty, SPACING } from "@medbrains/ui-mobile";
import type { ReactNode } from "react";
import { useCallback, useMemo, useState } from "react";
import { FlatList, View } from "react-native";
import { Button, Text } from "react-native-paper";
import { listActiveNurseCalls, updateNurseCallStatus } from "../../api/nursing.js";
import { ScreenHeader } from "../../components/screen-header.js";
import { useHasPermission } from "../../lib/permissions.js";
import { useFetch } from "../../lib/use-fetch.js";

/** A ward that has more than this waiting has a staffing problem, not a paging one. */
const PAGE_SIZE = 50;
const ROW_HEIGHT = 148;
/** WCAG 2.2 SC 2.5.8 and the surface rules both put the floor at 44. */
const TAP_TARGET = 44;

const ESCALATION_TONE = {
  charge_nurse: "warn",
  normal: "neutral",
  supervisor: "alert",
} as const;

/** The word, always beside the colour — never colour alone (WCAG 2.2 1.4.1). */
const ESCALATION_LABEL: Readonly<Record<NurseCallEscalation, string>> = {
  charge_nurse: "Charge nurse",
  normal: "Waiting",
  supervisor: "Supervisor",
};

const REQUEST_TYPE_LABEL: Readonly<Record<string, string>> = {
  bathroom_assist: "Bathroom",
  blanket_pillow: "Blanket / pillow",
  nurse_call: "Nurse call",
  other: "Assistance",
  pain_management: "Pain",
  position_change: "Reposition",
  water_food: "Water / food",
};

function waitingLabel(seconds: number): string {
  const { minutes, seconds: secs } = nurseCallWaitParts(seconds);
  return `${minutes}m ${secs}s waiting`;
}

export interface NurseCallBoardScreenProps {
  /** Narrow to one ward. Absent means every ward this tenant has. */
  wardId?: string;
}

export function NurseCallBoardScreen({ wardId }: NurseCallBoardScreenProps): ReactNode {
  const canRespond = useHasPermission("bedside.sessions.manage");
  const { data, loading, error, refetch } = useFetch(() => listActiveNurseCalls(wardId), [wardId]);

  const calls = useMemo(() => (data?.calls ?? []).slice(0, PAGE_SIZE), [data]);
  const overdue = useMemo(() => overdueNurseCalls(calls).length, [calls]);

  const renderItem = useCallback(
    ({ item }: { item: ActiveNurseCall }) => (
      <CallRow call={item} canRespond={canRespond} onChanged={refetch} />
    ),
    [canRespond, refetch],
  );

  return (
    <View style={{ backgroundColor: COLORS.canvas, flex: 1 }}>
      <ScreenHeader
        eyebrow="NURSE CALLS"
        title="Open calls"
        description="Every call still waiting, oldest first."
        trailing={overdue > 0 ? <Badge label={`${overdue} overdue`} tone="alert" /> : undefined}
      />

      {loading && (
        <View style={{ alignItems: "center", paddingVertical: SPACING.lg }}>
          <EcgLoader />
        </View>
      )}

      {/* An outage must not read as a quiet ward. "No open calls" and "we
          could not ask" are different facts and a nurse acts differently on
          each. */}
      {error && (
        <Empty
          title="Call board unavailable"
          description="The ward's calls could not be loaded. Do not read this as a quiet ward — check the station board or the handset."
          actionLabel="Try again"
          onAction={refetch}
        />
      )}

      {!loading && !error && calls.length === 0 && (
        <Empty title="No open calls" description="Every call has been answered." />
      )}

      {!loading && !error && calls.length > 0 && (
        <FlatList
          contentContainerStyle={{ gap: SPACING.sm, padding: SPACING.md }}
          data={calls}
          getItemLayout={itemLayout}
          initialNumToRender={8}
          keyExtractor={keyOf}
          removeClippedSubviews
          renderItem={renderItem}
          windowSize={5}
        />
      )}
    </View>
  );
}

function keyOf(call: ActiveNurseCall): string {
  return call.id;
}

function itemLayout(_: unknown, index: number) {
  return { index, length: ROW_HEIGHT, offset: ROW_HEIGHT * index };
}

function CallRow({
  call,
  canRespond,
  onChanged,
}: {
  call: ActiveNurseCall;
  canRespond: boolean;
  onChanged: () => void;
}): ReactNode {
  const [busy, setBusy] = useState(false);

  const respond = useCallback(
    async (status: "acknowledged" | "completed") => {
      setBusy(true);
      try {
        await updateNurseCallStatus(call.id, status);
        onChanged();
      } finally {
        // The row unbusies even when the call failed, so a nurse can try
        // again. A button that never comes back reads as "it worked".
        setBusy(false);
      }
    },
    [call.id, onChanged],
  );

  return (
    <View
      style={{
        backgroundColor: COLORS.panel,
        borderColor: COLORS.rule,
        borderLeftColor:
          call.escalation === "supervisor"
            ? COLORS.red
            : call.escalation === "charge_nurse"
              ? COLORS.amber
              : COLORS.emerald,
        borderLeftWidth: 6,
        borderWidth: 1,
        gap: SPACING.xs,
        padding: SPACING.md,
      }}
    >
      <View style={{ flexDirection: "row", gap: SPACING.sm, justifyContent: "space-between" }}>
        <Text variant="titleMedium" style={{ color: COLORS.ink }}>
          {call.bed_number ?? "No bed"}
          {call.ward_name ? ` · ${call.ward_name}` : ""}
        </Text>
        <Badge label={ESCALATION_LABEL[call.escalation]} tone={ESCALATION_TONE[call.escalation]} />
      </View>

      <Text style={{ color: COLORS.ink }}>
        {REQUEST_TYPE_LABEL[call.request_type] ?? "Assistance"}
      </Text>
      {call.notes ? <Text style={{ color: COLORS.muted }}>{call.notes}</Text> : null}
      <Text style={{ color: COLORS.muted }}>
        {waitingLabel(call.waiting_seconds)}
        {call.acknowledged_at ? " · seen" : ""}
      </Text>

      {canRespond && (
        <View style={{ flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.xs }}>
          {call.acknowledged_at === null && (
            <Button
              accessibilityLabel={`Mark the call from ${call.bed_number ?? "an unassigned bed"} as seen`}
              disabled={busy}
              mode="outlined"
              onPress={() => respond("acknowledged")}
              style={{ minHeight: TAP_TARGET, justifyContent: "center" }}
            >
              Seen
            </Button>
          )}
          <Button
            accessibilityLabel={`Mark the call from ${call.bed_number ?? "an unassigned bed"} as answered`}
            disabled={busy}
            mode="contained"
            onPress={() => respond("completed")}
            style={{ minHeight: TAP_TARGET, justifyContent: "center" }}
          >
            Done
          </Button>
        </View>
      )}
    </View>
  );
}
