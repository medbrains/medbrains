/**
 * Nurse → SBAR shift handover for one encounter.
 *
 * Covers three things a shift change has to carry: the SBAR narrative itself,
 * pending work that must not be dropped between shifts, and patients the
 * incoming nurse has to be warned about. Handovers addressed to the signed-in
 * nurse and not yet accepted are surfaced first, because an unaccepted handover
 * is work nobody has taken responsibility for.
 *
 * The list is a FlatList with a fixed row height and a bounded page, per
 * `docs/DEVICE-CONSTRAINED-RULES.md` — a ward accumulates handovers all year
 * and this screen must not grow with it.
 */

import { useAuthStore } from "@medbrains/mobile-shell";
import { Badge, COLORS, EcgLoader, Empty, MobileTextField, SPACING } from "@medbrains/ui-mobile";
import type { ReactNode } from "react";
import { useCallback, useMemo, useState } from "react";
import { FlatList, View } from "react-native";
import { Button, Text } from "react-native-paper";
import type { HandoffAlert, ShiftHandoff } from "../../api/nursing.js";
import {
  acceptHandoff,
  createHandoff,
  listHandoffs,
  outstandingAlerts,
  pendingForNurse,
} from "../../api/nursing.js";
import { ScreenHeader } from "../../components/screen-header.js";
import { useHasPermission } from "../../lib/permissions.js";
import { useFetch } from "../../lib/use-fetch.js";

/** Newest handovers only — the ward's history is unbounded, the screen is not. */
const PAGE_SIZE = 50;
const ROW_HEIGHT = 132;
/** WCAG 2.2 SC 2.5.8 and the surface rules both put the floor at 44. */
const TAP_TARGET = 44;

export interface ShiftHandoverScreenProps {
  encounterId: string;
  patientName: string;
  uhid: string;
  /** The nurse taking over. Absent until one is picked. */
  incomingNurseId?: string;
}

export function ShiftHandoverScreen({
  encounterId,
  patientName,
  uhid,
  incomingNurseId,
}: ShiftHandoverScreenProps): ReactNode {
  const nurseId = useAuthStore((state) => state.identity?.userId ?? "");
  const canRecord = useHasPermission("nurse.handoff.record");
  const { data, loading, error, refetch } = useFetch(
    () => listHandoffs(encounterId),
    [encounterId],
  );

  const handoffs = useMemo(() => (data ?? []).slice(0, PAGE_SIZE), [data]);
  const pending = useMemo(() => pendingForNurse(handoffs, nurseId), [handoffs, nurseId]);
  const carried = useMemo(() => outstandingAlerts(handoffs), [handoffs]);

  const renderItem = useCallback(
    ({ item }: { item: ShiftHandoff }) => (
      <HandoffRow handoff={item} isMine={item.incoming_nurse_id === nurseId} onAccepted={refetch} />
    ),
    [nurseId, refetch],
  );

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.canvas }}>
      <ScreenHeader
        eyebrow="SBAR HANDOVER"
        title={patientName}
        description={`UHID ${uhid}`}
        trailing={
          pending.length > 0 ? (
            <Badge tone="alert" label={`${pending.length} to accept`} />
          ) : undefined
        }
      />

      {carried.length > 0 && <CarriedOverBanner alerts={carried} />}

      {loading && (
        <View style={{ alignItems: "center", paddingVertical: SPACING.lg }}>
          <EcgLoader />
        </View>
      )}

      {error && (
        <Empty
          title="Handover unavailable"
          description="The shift handover could not be loaded. Nothing has been signed."
        />
      )}

      {!loading && !error && handoffs.length === 0 && (
        <Empty
          title="No handover recorded"
          description="Nothing has been handed over for this encounter yet."
        />
      )}

      {!loading && !error && handoffs.length > 0 && (
        <FlatList
          data={handoffs}
          keyExtractor={keyOf}
          renderItem={renderItem}
          getItemLayout={itemLayout}
          initialNumToRender={8}
          windowSize={5}
          removeClippedSubviews
          contentContainerStyle={{ padding: SPACING.md, gap: SPACING.sm }}
        />
      )}

      {canRecord && incomingNurseId && (
        <ComposeHandover
          encounterId={encounterId}
          incomingNurseId={incomingNurseId}
          onRecorded={refetch}
        />
      )}
    </View>
  );
}

function keyOf(handoff: ShiftHandoff): string {
  return handoff.id;
}

function itemLayout(_: unknown, index: number) {
  return { length: ROW_HEIGHT, offset: ROW_HEIGHT * index, index };
}

function CarriedOverBanner({ alerts }: { alerts: HandoffAlert[] }): ReactNode {
  const critical = alerts.filter((alert) => alert.kind === "critical");
  const tasks = alerts.filter((alert) => alert.kind === "task");
  return (
    <View
      style={{
        marginHorizontal: SPACING.md,
        marginTop: SPACING.sm,
        padding: SPACING.sm,
        backgroundColor: critical.length > 0 ? COLORS.tint : COLORS.panel,
        borderRadius: 2,
        gap: SPACING.xs,
      }}
    >
      <Text variant="labelSmall">
        {critical.length > 0 ? "CRITICAL — CARRIED OVER" : "CARRIED OVER"}
      </Text>
      {[...critical, ...tasks].map((alert) => (
        <Text key={`${alert.kind}:${alert.note}`} variant="bodySmall">
          {alert.kind === "critical" ? "! " : "• "}
          {alert.note}
        </Text>
      ))}
    </View>
  );
}

function HandoffRow({
  handoff,
  isMine,
  onAccepted,
}: {
  handoff: ShiftHandoff;
  isMine: boolean;
  onAccepted: () => void;
}): ReactNode {
  const [accepting, setAccepting] = useState(false);
  const [failed, setFailed] = useState(false);
  const awaitingMe = isMine && handoff.incoming_signed_at === null;

  const accept = useCallback(async () => {
    setAccepting(true);
    setFailed(false);
    try {
      await acceptHandoff(handoff.id);
      onAccepted();
    } catch {
      // Accepting is a signature. A failure must read as "not signed", never
      // as a silent success.
      setFailed(true);
    } finally {
      setAccepting(false);
    }
  }, [handoff.id, onAccepted]);

  return (
    <View
      style={{
        height: ROW_HEIGHT,
        padding: SPACING.sm,
        backgroundColor: COLORS.canvas,
        borderRadius: 2,
        gap: SPACING.xs,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text variant="labelSmall">{formatWhen(handoff.created_at)}</Text>
        <Badge
          tone={handoff.completed_at ? "success" : awaitingMe ? "alert" : "info"}
          label={handoff.completed_at ? "Accepted" : awaitingMe ? "Awaiting you" : "Awaiting nurse"}
        />
      </View>

      <Text variant="bodySmall" numberOfLines={2}>
        {handoff.situation ?? "No situation recorded"}
      </Text>
      <Text variant="bodySmall" numberOfLines={1}>
        {handoff.recommendation ?? "No recommendation recorded"}
      </Text>

      {failed && (
        <Text variant="bodySmall" style={{ color: COLORS.red }}>
          Not accepted — try again.
        </Text>
      )}

      {awaitingMe && (
        <Button
          mode="contained"
          compact
          disabled={accepting}
          loading={accepting}
          onPress={accept}
          style={{ minHeight: TAP_TARGET, justifyContent: "center" }}
          accessibilityLabel={`Accept handover recorded ${formatWhen(handoff.created_at)}`}
        >
          Accept handover
        </Button>
      )}
    </View>
  );
}

function ComposeHandover({
  encounterId,
  incomingNurseId,
  onRecorded,
}: {
  encounterId: string;
  incomingNurseId: string;
  onRecorded: () => void;
}): ReactNode {
  const [open, setOpen] = useState(false);
  const [situation, setSituation] = useState("");
  const [background, setBackground] = useState("");
  const [assessment, setAssessment] = useState("");
  const [recommendation, setRecommendation] = useState("");
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const submit = useCallback(async () => {
    setSaving(true);
    setFailed(false);
    try {
      await createHandoff({
        encounter_id: encounterId,
        incoming_nurse_id: incomingNurseId,
        situation: situation.trim() || undefined,
        background: background.trim() || undefined,
        assessment: assessment.trim() || undefined,
        recommendation: recommendation.trim() || undefined,
      });
      setSituation("");
      setBackground("");
      setAssessment("");
      setRecommendation("");
      setOpen(false);
      onRecorded();
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }, [assessment, background, encounterId, incomingNurseId, onRecorded, recommendation, situation]);

  if (!open) {
    return (
      <View style={{ padding: SPACING.md }}>
        <Button
          mode="contained"
          onPress={() => setOpen(true)}
          style={{ minHeight: TAP_TARGET, justifyContent: "center" }}
          accessibilityLabel="Record a shift handover"
        >
          Record handover
        </Button>
      </View>
    );
  }

  return (
    <View style={{ padding: SPACING.md, gap: SPACING.sm, backgroundColor: COLORS.panel }}>
      <Text variant="labelSmall">SITUATION</Text>
      <MobileTextField value={situation} onChangeText={setSituation} label="Situation" multiline />
      <Text variant="labelSmall">BACKGROUND</Text>
      <MobileTextField
        value={background}
        onChangeText={setBackground}
        label="Background"
        multiline
      />
      <Text variant="labelSmall">ASSESSMENT</Text>
      <MobileTextField
        value={assessment}
        onChangeText={setAssessment}
        label="Assessment"
        multiline
      />
      <Text variant="labelSmall">RECOMMENDATION</Text>
      <MobileTextField
        value={recommendation}
        onChangeText={setRecommendation}
        label="Recommendation"
        multiline
      />

      {failed && (
        <Text variant="bodySmall" style={{ color: COLORS.red }}>
          Handover not recorded — nothing was signed. Try again.
        </Text>
      )}

      <View style={{ flexDirection: "row", gap: SPACING.sm }}>
        <Button
          mode="outlined"
          onPress={() => setOpen(false)}
          disabled={saving}
          style={{ flex: 1, minHeight: TAP_TARGET, justifyContent: "center" }}
        >
          Cancel
        </Button>
        <Button
          mode="contained"
          onPress={submit}
          disabled={saving}
          loading={saving}
          style={{ flex: 1, minHeight: TAP_TARGET, justifyContent: "center" }}
          accessibilityLabel="Sign and record this handover"
        >
          Sign handover
        </Button>
      </View>
    </View>
  );
}

function formatWhen(iso: string): string {
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? "—" : at.toLocaleString();
}
