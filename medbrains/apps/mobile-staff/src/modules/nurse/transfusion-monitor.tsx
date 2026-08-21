/**
 * Nurse → the transfusions running on this bed, and the observations they owe.
 *
 * The observation endpoint has existed since the blood bank shipped, keyed by
 * foreign key to `transfusions` — the bedside chart. Nothing in the product
 * ever inserted a row into that table, so no id a client could obtain would
 * satisfy the key, and the first fifteen minutes of a transfusion could not be
 * charted anywhere. The gate did not help either: it named
 * `blood_bank.transfusion.create`, which `blood_bank_tech` holds and no nurse
 * does.
 *
 * What this screen is for is the fifteen-minute check. An acute haemolytic
 * reaction declares itself early and the patient is still salvageable at that
 * point, so the phase is called out by name and goes red when it is late,
 * rather than sitting in a list of "vitals due".
 *
 * `reaction_suspected` is read, never computed. The server sets it from the
 * temperature and the signs, and a client that recomputed the threshold would
 * be a second opinion able to disagree with the record.
 */

import { Badge, COLORS, EcgLoader, Empty, MobileTextField, SPACING } from "@medbrains/ui-mobile";
import type { ReactNode } from "react";
import { useCallback, useState } from "react";
import { ScrollView, View } from "react-native";
import { Button, Checkbox, HelperText, Text } from "react-native-paper";
import type { AdmissionRow } from "../../api/ipd.js";
import type { BedsideTransfusion, TransfusionPhase } from "../../api/transfusion.js";
import {
  completeBedsideTransfusion,
  listBedsideTransfusions,
  listTransfusionObservations,
  recordTransfusionObservation,
} from "../../api/transfusion.js";
import { ScreenHeader } from "../../components/screen-header.js";
import { useHasPermission } from "../../lib/permissions.js";
import { useFetch } from "../../lib/use-fetch.js";
import { hasSuspectedReaction, isRunning, phaseStates } from "./transfusion.js";

/** WCAG 2.2 SC 2.5.8 and the mobile surface rules both put the floor at 44. */
const TAP_TARGET = 44;

const PHASE_LABEL: Record<TransfusionPhase, string> = {
  baseline: "Before starting",
  completion: "At the end",
  fifteen_min: "15 minutes in",
  periodic: "Hourly",
};

export interface TransfusionMonitorScreenProps {
  admission: AdmissionRow;
}

export function TransfusionMonitorScreen({ admission }: TransfusionMonitorScreenProps): ReactNode {
  const canRecord = useHasPermission("nurse.transfusion.administer");
  const { data, loading, error, refetch } = useFetch(
    () => listBedsideTransfusions(admission.id),
    [admission.id],
  );

  return (
    <ScrollView style={{ backgroundColor: COLORS.canvas, flex: 1 }}>
      <ScreenHeader
        eyebrow="TRANSFUSION"
        title={admission.patient_name}
        description={`UHID ${admission.uhid}${admission.bed_label ? ` · BED ${admission.bed_label}` : ""}`}
      />

      {loading && (
        <View style={{ alignItems: "center", paddingVertical: SPACING.lg }}>
          <EcgLoader />
        </View>
      )}

      {/* Not "no transfusions": a unit may be running and unreadable, and the
          difference decides whether the nurse charts or goes to look. */}
      {!loading && error && (
        <Empty
          title="Couldn't load the transfusion chart"
          description={`${error} — do not read this as nothing running; check the bedside chart.`}
          actionLabel="Retry"
          onAction={refetch}
        />
      )}

      {!loading && !error && (data?.length ?? 0) === 0 && (
        <Empty title="No transfusions" description="Nothing has been hung on this bed." />
      )}

      {!loading &&
        !error &&
        (data ?? []).map((transfusion) => (
          <TransfusionCard
            canRecord={canRecord}
            key={transfusion.id}
            onChanged={refetch}
            transfusion={transfusion}
          />
        ))}
    </ScrollView>
  );
}

function TransfusionCard({
  canRecord,
  onChanged,
  transfusion,
}: {
  canRecord: boolean;
  onChanged: () => void;
  transfusion: BedsideTransfusion;
}): ReactNode {
  const {
    data: observations,
    error,
    refetch,
  } = useFetch(() => listTransfusionObservations(transfusion.id), [transfusion.id]);
  const [phase, setPhase] = useState<TransfusionPhase | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const charted = observations ?? [];
  const running = isRunning(transfusion);
  const suspected = hasSuspectedReaction(charted);
  const states = phaseStates(transfusion, charted, Date.now());

  const complete = useCallback(async () => {
    setBusy(true);
    setFailure(null);
    try {
      await completeBedsideTransfusion(transfusion.id);
      onChanged();
    } catch (err) {
      setFailure(err instanceof Error ? err.message : "The unit could not be closed.");
    } finally {
      setBusy(false);
    }
  }, [transfusion.id, onChanged]);

  return (
    <View
      style={{
        backgroundColor: COLORS.panel,
        borderColor: suspected ? COLORS.red : COLORS.rule,
        borderLeftColor: suspected ? COLORS.red : running ? COLORS.emerald : COLORS.muted,
        borderLeftWidth: 6,
        borderWidth: 1,
        gap: SPACING.xs,
        margin: SPACING.md,
        padding: SPACING.md,
      }}
    >
      <View style={{ flexDirection: "row", gap: SPACING.sm, justifyContent: "space-between" }}>
        <Text variant="titleMedium" style={{ color: COLORS.ink }}>
          {transfusion.product_type ?? "Unit"} · {transfusion.blood_group ?? "?"}
          {transfusion.rh_factor ? ` ${transfusion.rh_factor}` : ""}
        </Text>
        <Badge
          label={suspected ? "reaction suspected" : running ? "running" : "finished"}
          tone={suspected ? "alert" : running ? "success" : "neutral"}
        />
      </View>
      <Text style={{ color: COLORS.muted, fontFamily: "JetBrainsMono-Regular" }}>
        BAG {transfusion.bag_number ?? "—"}
      </Text>

      {suspected && (
        <Text style={{ color: COLORS.red }}>
          Stop the transfusion, keep the line open, and call the doctor. Return the bag and the
          giving set to the blood bank.
        </Text>
      )}

      {/* A chart that cannot be read is not an empty chart. */}
      {error && (
        <HelperText type="error" visible accessibilityRole="alert">
          The observations could not be loaded, so what is outstanding is unknown.
        </HelperText>
      )}

      {!error &&
        states.map((state) => (
          <View
            key={state.phase}
            style={{ flexDirection: "row", gap: SPACING.sm, justifyContent: "space-between" }}
          >
            <Text style={{ color: COLORS.ink }}>{PHASE_LABEL[state.phase]}</Text>
            <Badge
              label={state.recorded ? "charted" : state.overdue ? "overdue" : "due later"}
              tone={state.recorded ? "success" : state.overdue ? "alert" : "neutral"}
            />
          </View>
        ))}

      {failure && (
        <HelperText type="error" visible accessibilityRole="alert">
          {failure}
        </HelperText>
      )}

      {canRecord && running && phase === null && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm }}>
          {states
            .filter((state) => state.phase !== "completion" || !running)
            .map((state) => (
              <Button
                accessibilityLabel={`Chart observations ${PHASE_LABEL[state.phase].toLowerCase()}`}
                key={state.phase}
                mode={state.overdue ? "contained" : "outlined"}
                onPress={() => setPhase(state.phase)}
                style={{ justifyContent: "center", minHeight: TAP_TARGET }}
              >
                {PHASE_LABEL[state.phase]}
              </Button>
            ))}
          <Button
            accessibilityLabel="Record the final observations and close this unit"
            disabled={busy}
            loading={busy}
            mode="outlined"
            onPress={() => setPhase("completion")}
            style={{ justifyContent: "center", minHeight: TAP_TARGET }}
          >
            Finish unit
          </Button>
        </View>
      )}

      {canRecord && phase !== null && (
        <ObservationForm
          onCancel={() => setPhase(null)}
          onRecorded={async (wasCompletion) => {
            setPhase(null);
            refetch();
            if (wasCompletion) {
              await complete();
            }
          }}
          phase={phase}
          transfusionId={transfusion.id}
        />
      )}
    </View>
  );
}

/**
 * An empty field is not a zero.
 *
 * A nurse who took a pulse and not a blood pressure charts the pulse; sending
 * 0 for the rest would record a patient with no measurable circulation.
 * A decimal comma is accepted because a handset keyboard set to most of Europe
 * offers one.
 */
function numeric(value: string): number | undefined {
  const parsed = Number.parseFloat(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * One set of observations.
 *
 * Temperature is the only field the server reasons about, so it is the only
 * one asked for first — but every field is optional except the signs tick,
 * because a nurse who has taken a pulse and not a blood pressure should be
 * able to chart the pulse rather than nothing.
 */
function ObservationForm({
  onCancel,
  onRecorded,
  phase,
  transfusionId,
}: {
  onCancel: () => void;
  onRecorded: (wasCompletion: boolean) => void;
  phase: TransfusionPhase;
  transfusionId: string;
}): ReactNode {
  const [temperature, setTemperature] = useState("");
  const [pulse, setPulse] = useState("");
  const [systolic, setSystolic] = useState("");
  const [diastolic, setDiastolic] = useState("");
  const [adverseSigns, setAdverseSigns] = useState(false);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const save = useCallback(async () => {
    setBusy(true);
    setFailure(null);
    try {
      await recordTransfusionObservation(transfusionId, {
        adverse_signs: adverseSigns,
        diastolic_bp: numeric(diastolic),
        notes: notes.trim() || undefined,
        phase,
        pulse: numeric(pulse),
        systolic_bp: numeric(systolic),
        temperature_c: numeric(temperature),
      });
      onRecorded(phase === "completion");
    } catch (err) {
      setFailure(err instanceof Error ? err.message : "The observations could not be saved.");
    } finally {
      setBusy(false);
    }
  }, [
    adverseSigns,
    diastolic,
    notes,
    phase,
    pulse,
    systolic,
    temperature,
    transfusionId,
    onRecorded,
  ]);

  return (
    <View style={{ gap: SPACING.sm, marginTop: SPACING.sm }}>
      <Text variant="titleSmall" style={{ color: COLORS.ink }}>
        {PHASE_LABEL[phase]}
      </Text>
      <MobileTextField
        accessibilityLabel="Temperature in degrees Celsius"
        keyboardType="decimal-pad"
        label="Temperature (°C)"
        onChangeText={setTemperature}
        value={temperature}
      />
      <MobileTextField
        accessibilityLabel="Pulse in beats per minute"
        keyboardType="number-pad"
        label="Pulse"
        onChangeText={setPulse}
        value={pulse}
      />
      <View style={{ flexDirection: "row", gap: SPACING.sm }}>
        <View style={{ flex: 1 }}>
          <MobileTextField
            accessibilityLabel="Systolic blood pressure"
            keyboardType="number-pad"
            label="Systolic"
            onChangeText={setSystolic}
            value={systolic}
          />
        </View>
        <View style={{ flex: 1 }}>
          <MobileTextField
            accessibilityLabel="Diastolic blood pressure"
            keyboardType="number-pad"
            label="Diastolic"
            onChangeText={setDiastolic}
            value={diastolic}
          />
        </View>
      </View>
      <Checkbox.Item
        label="Rigors, rash, breathlessness or back pain"
        onPress={() => setAdverseSigns((on) => !on)}
        status={adverseSigns ? "checked" : "unchecked"}
        style={{ minHeight: TAP_TARGET }}
      />
      <MobileTextField
        accessibilityLabel="Notes on this observation"
        label="Notes"
        multiline
        onChangeText={setNotes}
        value={notes}
      />
      {failure && (
        <HelperText type="error" visible accessibilityRole="alert">
          {failure}
        </HelperText>
      )}
      <View style={{ flexDirection: "row", gap: SPACING.sm }}>
        <Button
          accessibilityLabel="Save these observations"
          disabled={busy}
          loading={busy}
          mode="contained"
          onPress={save}
          style={{ justifyContent: "center", minHeight: TAP_TARGET }}
        >
          Save
        </Button>
        <Button
          accessibilityLabel="Cancel"
          mode="text"
          onPress={onCancel}
          style={{ justifyContent: "center", minHeight: TAP_TARGET }}
        >
          Cancel
        </Button>
      </View>
    </View>
  );
}
