/**
 * Record a medical-gas reading at the manifold.
 *
 * The plant room is nowhere near a desk, which is the whole reason this belongs
 * on a phone. Medical gas is a PESO-logged, life-critical supply: the round
 * gets walked whether or not there is a terminal at the end of it, and a round
 * written on paper is one that gets typed up later, from memory, or not at all.
 *
 * The form states no opinion on whether a value is safe — see `lib/gas-reading`
 * for why inventing a threshold here would be worse than leaving the judgement
 * with the engineer. It does refuse a record that contradicts itself.
 */

import { COLORS, FormScrollView, MobileTextField, SPACING } from "@medbrains/ui-mobile";
import type { ReactNode } from "react";
import { useState } from "react";
import { View } from "react-native";
import { Button, HelperText, SegmentedButtons, Switch, Text } from "react-native-paper";
import { recordGasReading } from "../../api/facilities.js";
import { ReferenceMenu } from "../../components/reference-menu.js";
import { ScreenHeader } from "../../components/screen-header.js";
import { checkGasReading } from "../../lib/gas-reading.js";

/** Mirrors GAS_TYPES on the web MGPS tab so the phone and the desk agree. */
const GASES = [
  { id: "oxygen", name: "Oxygen" },
  { id: "nitrous_oxide", name: "Nitrous oxide" },
  { id: "nitrogen", name: "Nitrogen" },
  { id: "medical_air", name: "Medical air" },
  { id: "vacuum", name: "Vacuum" },
  { id: "co2", name: "CO2" },
  { id: "heliox", name: "Heliox" },
];

const SOURCES = [
  { value: "psa_plant", label: "PSA" },
  { value: "lmo_tank", label: "LMO" },
  { value: "cylinder_manifold", label: "Manifold" },
  { value: "pipeline", label: "Pipeline" },
];

export function GasReadingScreen(): ReactNode {
  const [gasType, setGasType] = useState("oxygen");
  const [sourceType, setSourceType] = useState("pipeline");
  const [purity, setPurity] = useState("");
  const [pressure, setPressure] = useState("");
  const [tankLevel, setTankLevel] = useState("");
  const [isAlarm, setIsAlarm] = useState(false);
  const [alarmReason, setAlarmReason] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const draft = {
    purity_percent: purity,
    pressure_bar: pressure,
    tank_level_percent: tankLevel,
    is_alarm: isAlarm,
    alarm_reason: alarmReason,
  };
  const problems = checkGasReading(draft);

  const toNumber = (raw: string) => (raw.trim() === "" ? undefined : Number(raw));

  const submit = async () => {
    if (!problems.canSubmit) {
      return;
    }
    setBusy(true);
    setFailure(null);
    try {
      await recordGasReading({
        gas_type: gasType,
        source_type: sourceType,
        purity_percent: toNumber(purity),
        pressure_bar: toNumber(pressure),
        tank_level_percent: toNumber(tankLevel),
        is_alarm: isAlarm,
        alarm_reason: isAlarm ? alarmReason.trim() : undefined,
        notes: notes.trim() || undefined,
      });
      setSaved(true);
    } catch (cause) {
      setFailure(cause instanceof Error ? cause.message : "Could not record the reading.");
    } finally {
      setBusy(false);
    }
  };

  if (saved) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.canvas }}>
        <ScreenHeader eyebrow="FACILITIES" title="Reading recorded" />
        <View style={{ padding: SPACING.md, gap: SPACING.sm }}>
          <Text variant="bodyMedium" style={{ color: COLORS.ink }}>
            Logged against your name and the time you took it.
          </Text>
          <Button
            mode="contained"
            onPress={() => {
              setSaved(false);
              setPurity("");
              setPressure("");
              setTankLevel("");
              setIsAlarm(false);
              setAlarmReason("");
              setNotes("");
            }}
            accessibilityLabel="Record the next reading"
          >
            Next reading
          </Button>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.canvas }}>
      <ScreenHeader
        eyebrow="FACILITIES"
        title="Gas reading"
        description="MGPS round. Logged against your name."
      />
      <FormScrollView>
        <ReferenceMenu
          title="Gas"
          rows={GASES}
          selectedId={gasType}
          label={(row) => row.name}
          placeholder="Pick a gas"
          onSelect={(row) => setGasType(row.id)}
        />

        <Text variant="labelLarge" style={{ color: COLORS.ink, marginTop: SPACING.xs }}>
          Source
        </Text>
        <SegmentedButtons
          value={sourceType}
          onValueChange={setSourceType}
          buttons={SOURCES.map((s) => ({
            value: s.value,
            label: s.label,
            accessibilityLabel: s.label,
          }))}
        />

        <MobileTextField
          label="Purity %"
          value={purity}
          onChangeText={setPurity}
          keyboardType="decimal-pad"
          error={Boolean(problems.purity)}
        />
        <HelperText type="error" visible={Boolean(problems.purity)}>
          {problems.purity ?? " "}
        </HelperText>

        <MobileTextField
          label="Pressure (bar)"
          value={pressure}
          onChangeText={setPressure}
          keyboardType="decimal-pad"
          error={Boolean(problems.pressure)}
        />
        <HelperText type="error" visible={Boolean(problems.pressure)}>
          {problems.pressure ?? " "}
        </HelperText>

        <MobileTextField
          label="Tank level %"
          value={tankLevel}
          onChangeText={setTankLevel}
          keyboardType="decimal-pad"
          error={Boolean(problems.tankLevel)}
        />
        <HelperText type="error" visible={Boolean(problems.tankLevel)}>
          {problems.tankLevel ?? " "}
        </HelperText>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: SPACING.xs,
          }}
        >
          <Text variant="labelLarge" style={{ color: COLORS.ink }}>
            Alarm condition
          </Text>
          <Switch
            value={isAlarm}
            onValueChange={setIsAlarm}
            accessibilityLabel="Mark this reading as an alarm condition"
          />
        </View>

        {isAlarm && (
          <>
            <MobileTextField
              label="What is the alarm"
              value={alarmReason}
              onChangeText={setAlarmReason}
              multiline
              numberOfLines={3}
              error={Boolean(problems.alarmReason)}
            />
            <HelperText type="error" visible={Boolean(problems.alarmReason)}>
              {problems.alarmReason ?? " "}
            </HelperText>
          </>
        )}

        <MobileTextField
          label="Notes (optional)"
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={2}
        />

        {failure && (
          <HelperText type="error" visible accessibilityRole="alert">
            {failure}
          </HelperText>
        )}

        <Button
          mode="contained"
          onPress={submit}
          loading={busy}
          disabled={busy || !problems.canSubmit}
          accessibilityLabel="Record this gas reading"
        >
          {busy ? "Recording…" : "Record reading"}
        </Button>
      </FormScrollView>
    </View>
  );
}
