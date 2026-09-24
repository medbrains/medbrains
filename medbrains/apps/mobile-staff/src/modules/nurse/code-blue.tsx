/**
 * Nurse → the arrests in progress, on the phone the page reaches.
 *
 * A code blue pages every active doctor and nurse. Until now the phone had
 * no idea: the page lived in the web bell, and a nurse on the ward carries a
 * handset, not a workstation. This screen is where they answer it.
 *
 * One act, **Responding**, and it is deliberately not "Seen": the server
 * records it as an arrival, the first one fills NABH's response-time
 * measure, and the lead running the arrest sees the name appear. Saying you
 * are coming when you are not is worse than silence, and the button says so.
 *
 * Polls every five seconds while mounted and stops when it leaves — an
 * arrest is the one screen where stale is dangerous, and the one where a
 * timer left running would matter (`docs/DEVICE-CONSTRAINED-RULES.md`).
 */

import { useAuthStore } from "@medbrains/mobile-shell";
import type { CodeBlueEventRow, CodeBlueResponder } from "@medbrains/types";
import { Badge, COLORS, EcgLoader, Empty, SPACING } from "@medbrains/ui-mobile";
import type { ReactNode } from "react";
import { useCallback, useMemo, useState } from "react";
import { FlatList, View } from "react-native";
import { Button, Text } from "react-native-paper";
import {
  listActiveCodeBlues,
  listCodeBlueResponders,
  respondToCodeBlue,
} from "../../api/nursing.js";
import { ScreenHeader } from "../../components/screen-header.js";
import { useHasPermission } from "../../lib/permissions.js";
import { useFetch } from "../../lib/use-fetch.js";

/** More than this many simultaneous arrests is a disaster, not a list. */
const PAGE_SIZE = 20;
const ROW_HEIGHT = 176;
const TAP_TARGET = 44;
const POLL_MS = 5000;

function sinceLabel(startedAt: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s since the call`;
}

export function CodeBlueScreen(): ReactNode {
  const canRespond = useHasPermission("nurse.code_blue.respond");
  const me = useAuthStore((s) => s.identity?.userId ?? null);

  const events = useFetch(listActiveCodeBlues, [], { intervalMs: POLL_MS });
  const active = useMemo(() => (events.data ?? []).slice(0, PAGE_SIZE), [events.data]);
  const hasActive = active.length > 0;

  // Responders only matter while something is active; no arrest, no poll.
  const responders = useFetch(
    () => (hasActive ? listCodeBlueResponders() : Promise.resolve([])),
    [hasActive],
    { intervalMs: hasActive ? POLL_MS : undefined },
  );
  const byEvent = useMemo(() => {
    const map = new Map<string, CodeBlueResponder[]>();
    for (const r of responders.data ?? []) {
      const list = map.get(r.code_blue_id);
      if (list) list.push(r);
      else map.set(r.code_blue_id, [r]);
    }
    return map;
  }, [responders.data]);

  const renderItem = useCallback(
    ({ item }: { item: CodeBlueEventRow }) => (
      <ArrestRow
        event={item}
        responders={byEvent.get(item.id) ?? []}
        me={me}
        canRespond={canRespond}
        onChanged={responders.refetch}
      />
    ),
    [byEvent, me, canRespond, responders.refetch],
  );

  return (
    <View style={{ backgroundColor: COLORS.canvas, flex: 1 }}>
      <ScreenHeader
        testID="screen-code-blue"
        eyebrow="CODE BLUE"
        title="Arrests in progress"
        description="Answer the page here. The first answer is the team's arrival time."
        trailing={hasActive ? <Badge label={`${active.length} active`} tone="alert" /> : undefined}
      />

      {events.loading && !events.data && (
        <View style={{ alignItems: "center", paddingVertical: SPACING.lg }}>
          <EcgLoader />
        </View>
      )}

      {/* An outage must not read as "no arrest". Those are different facts
          and the difference is somebody's heart. */}
      {events.error && (
        <Empty
          title="Code blue board unavailable"
          description="Arrests could not be loaded. Do not read this as none in progress — go to the ward or call the switchboard."
          actionLabel="Try again"
          onAction={events.refetch}
        />
      )}

      {!events.error && events.data && !hasActive && (
        <View testID="code-blue-empty">
          <Empty title="No arrest in progress" description="Nothing has been called." />
        </View>
      )}

      {!events.error && hasActive && (
        <FlatList
          testID="code-blue-list"
          contentContainerStyle={{ gap: SPACING.sm, padding: SPACING.md }}
          data={active}
          getItemLayout={itemLayout}
          initialNumToRender={4}
          keyExtractor={keyOf}
          removeClippedSubviews
          renderItem={renderItem}
          windowSize={3}
        />
      )}
    </View>
  );
}

function keyOf(event: CodeBlueEventRow): string {
  return event.id;
}

function itemLayout(_: unknown, index: number) {
  return { index, length: ROW_HEIGHT, offset: ROW_HEIGHT * index };
}

function ArrestRow({
  event,
  responders,
  me,
  canRespond,
  onChanged,
}: {
  event: CodeBlueEventRow;
  responders: CodeBlueResponder[];
  me: string | null;
  canRespond: boolean;
  onChanged: () => void;
}): ReactNode {
  const [busy, setBusy] = useState(false);
  const responded = responders.some((r) => r.user_id === me);
  const first = responders[0];

  const respond = useCallback(async () => {
    setBusy(true);
    try {
      await respondToCodeBlue(event.id);
      onChanged();
    } finally {
      // Unbusy on failure too, so a nurse can try again; a button that never
      // comes back reads as "it worked".
      setBusy(false);
    }
  }, [event.id, onChanged]);

  return (
    <View
      style={{
        backgroundColor: COLORS.panel,
        borderColor: COLORS.rule,
        borderLeftColor: COLORS.red,
        borderLeftWidth: 6,
        borderWidth: 1,
        gap: SPACING.xs,
        padding: SPACING.md,
      }}
    >
      <View style={{ flexDirection: "row", gap: SPACING.sm, justifyContent: "space-between" }}>
        <Text variant="titleMedium" style={{ color: COLORS.ink }}>
          {event.location}
        </Text>
        <Badge label="ACTIVE" tone="alert" />
      </View>
      <Text style={{ color: COLORS.muted }}>{sinceLabel(event.started_at)}</Text>

      {/* "Nobody yet" is the most important state this list has. It must be
          words, never a blank. */}
      {first ? (
        <Text style={{ color: COLORS.ink }}>
          First on scene: {first.user_name} (+{first.seconds_after_call}s)
          {responders.length > 1 ? ` · ${responders.length - 1} more responding` : ""}
        </Text>
      ) : (
        <Text style={{ color: COLORS.amber }}>Nobody has responded yet.</Text>
      )}

      {canRespond && (
        <Button
          accessibilityLabel={
            responded
              ? `You are responding to the code blue at ${event.location}`
              : `Respond to the code blue at ${event.location}`
          }
          testID="code-blue-respond"
          disabled={busy || responded}
          mode={responded ? "outlined" : "contained"}
          onPress={respond}
          style={{ minHeight: TAP_TARGET, justifyContent: "center", marginTop: SPACING.xs }}
        >
          {responded ? "You are responding" : "Responding"}
        </Button>
      )}
    </View>
  );
}
