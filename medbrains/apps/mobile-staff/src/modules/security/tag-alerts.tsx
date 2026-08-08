/**
 * Open infant-RFID and wander-guard alerts.
 *
 * This is the Code Pink path: a tagged patient — a newborn, or someone at risk
 * of wandering — has crossed a boundary they should not have. The guard who can
 * act is walking the building, not sitting at the desk where this used to be
 * visible.
 *
 * Two things differ from every other list in this app.
 *
 * It is ordered **oldest first**. Everywhere else newest-first is right because
 * recent means relevant; here the longest-unanswered alert is the one where the
 * patient has had the most time to leave the building.
 *
 * Resolving asks what was found before it will close. An alert closed with no
 * account is indistinguishable afterwards from one nobody attended, and these
 * are exactly the records an investigation reads.
 */

import {
  Badge,
  COLORS,
  EcgLoader,
  Empty,
  FormScrollView,
  MobileTextField,
  SPACING,
} from "@medbrains/ui-mobile";
import type { ReactNode } from "react";
import { useCallback, useMemo, useState } from "react";
import { FlatList, View } from "react-native";
import { Button, HelperText, SegmentedButtons, Text } from "react-native-paper";
import type { TagAlertRow } from "../../api/security.js";
import { listOpenTagAlerts, resolveTagAlert } from "../../api/security.js";
import { EntityRow } from "../../components/entity-row.js";
import { ScreenHeader } from "../../components/screen-header.js";
import { byMostUrgent, minutesSinceTrigger, needsEscalation } from "../../lib/tag-alerts.js";
import { useFetch } from "../../lib/use-fetch.js";

/** Bounded like every constrained-surface list; more than this is a mass event. */
const MAX_ALERTS = 50;

/** Enough that "resolved" means something an investigator can read. */
const MIN_NOTES = 8;

export function TagAlertsScreen(): ReactNode {
  const { data, loading, error, refetch } = useFetch(listOpenTagAlerts, []);
  const [selected, setSelected] = useState<TagAlertRow | null>(null);

  const alerts = useMemo(() => byMostUrgent(data ?? []).slice(0, MAX_ALERTS), [data]);

  if (selected) {
    return (
      <ResolveAlert
        alert={selected}
        onDone={() => {
          setSelected(null);
          refetch();
        }}
        onCancel={() => setSelected(null)}
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.canvas }}>
      <ScreenHeader
        eyebrow="SECURITY"
        title="Tag alerts"
        description="Infant RFID and wander guard. Oldest first."
        trailing={alerts.length > 0 ? <Badge tone="alert" label={`${alerts.length}`} /> : undefined}
      />

      {loading && (
        <View style={{ alignItems: "center", paddingVertical: SPACING.lg }}>
          <EcgLoader />
        </View>
      )}

      {!loading && error && (
        <Empty
          title="Couldn't load alerts"
          description={error}
          actionLabel="Retry"
          onAction={refetch}
        />
      )}

      {!loading && !error && alerts.length === 0 && (
        <Empty title="No open alerts" description="Every tag alert has been closed." />
      )}

      {!loading && !error && alerts.length > 0 && (
        <FlatList
          data={alerts}
          keyExtractor={(alert) => alert.id}
          renderItem={({ item }) => <AlertCard alert={item} onRespond={() => setSelected(item)} />}
          contentContainerStyle={{ padding: SPACING.md }}
        />
      )}
    </View>
  );
}

function AlertCard({ alert, onRespond }: { alert: TagAlertRow; onRespond: () => void }): ReactNode {
  const minutes = minutesSinceTrigger(alert);
  const escalate = needsEscalation(minutes);

  return (
    <View style={{ marginBottom: SPACING.sm }}>
      <EntityRow
        title={alert.alert_type.replace(/_/g, " ")}
        subtitle={`${alert.location_description ?? "Location not recorded"} · ${
          minutes === null ? "time unknown" : `${minutes} MIN AGO`
        }`}
        accent={escalate}
        badge={escalate ? { label: "escalate", tone: "alert" } : { label: "open", tone: "warn" }}
      />
      <Button
        mode="contained"
        onPress={onRespond}
        accessibilityLabel={`Respond to ${alert.alert_type.replace(/_/g, " ")} alert`}
        style={{ marginTop: SPACING.xs }}
      >
        Respond
      </Button>
    </View>
  );
}

function ResolveAlert({
  alert,
  onDone,
  onCancel,
}: {
  alert: TagAlertRow;
  onDone: () => void;
  onCancel: () => void;
}): ReactNode {
  const [outcome, setOutcome] = useState("genuine");
  const [notes, setNotes] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const notesError =
    touched && notes.trim().length < MIN_NOTES
      ? "Say what you found. This is the record an investigation reads."
      : null;

  const submit = useCallback(async () => {
    setTouched(true);
    if (notes.trim().length < MIN_NOTES) {
      return;
    }
    setBusy(true);
    setFailure(null);
    try {
      await resolveTagAlert(alert.id, {
        was_false_alarm: outcome === "false_alarm",
        resolution_notes: notes.trim(),
      });
      onDone();
    } catch (cause) {
      setFailure(cause instanceof Error ? cause.message : "Could not close the alert.");
    } finally {
      setBusy(false);
    }
  }, [alert.id, notes, onDone, outcome]);

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.canvas }}>
      <ScreenHeader
        eyebrow="SECURITY"
        title="Close this alert"
        description={alert.alert_type.replace(/_/g, " ")}
      />
      <FormScrollView>
        <Text variant="labelLarge" style={{ color: COLORS.ink }}>
          What was it
        </Text>
        <SegmentedButtons
          value={outcome}
          onValueChange={setOutcome}
          buttons={[
            { value: "genuine", label: "Genuine", accessibilityLabel: "Genuine alert" },
            { value: "false_alarm", label: "False alarm", accessibilityLabel: "False alarm" },
          ]}
        />
        <Text variant="bodySmall" style={{ color: COLORS.brandDeep, opacity: 0.7 }}>
          A false alarm still stays on the record — a tag that keeps misfiring is a tag nobody will
          trust the next time.
        </Text>

        <MobileTextField
          label="What did you find"
          value={notes}
          onChangeText={setNotes}
          onBlur={() => setTouched(true)}
          multiline
          numberOfLines={4}
          error={Boolean(notesError)}
        />
        <HelperText type="error" visible={Boolean(notesError)}>
          {notesError ?? " "}
        </HelperText>

        {failure && (
          <HelperText type="error" visible accessibilityRole="alert">
            {failure}
          </HelperText>
        )}

        <Button
          mode="contained"
          onPress={submit}
          loading={busy}
          disabled={busy}
          accessibilityLabel="Close this alert"
        >
          {busy ? "Closing…" : "Close alert"}
        </Button>
        <Button mode="outlined" onPress={onCancel} accessibilityLabel="Go back without closing">
          Not yet
        </Button>
      </FormScrollView>
    </View>
  );
}
