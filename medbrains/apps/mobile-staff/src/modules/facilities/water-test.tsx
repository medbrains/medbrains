/**
 * Record a water test at the sample point.
 *
 * Potable and dialysis water are both statutory logs, and dialysis water is the
 * one that matters most: a chemical or endotoxin exceedance reaches a patient's
 * bloodstream directly, with nothing in between.
 *
 * Unlike the gas screen, this one does judge compliance — because the
 * acceptable range is recorded with the test rather than invented here. See
 * `lib/water-test` for why that distinction decides whether a screen may have
 * an opinion.
 */

import { COLORS, FormScrollView, MobileTextField, SPACING } from "@medbrains/ui-mobile";
import type { ReactNode } from "react";
import { useState } from "react";
import { View } from "react-native";
import { Button, HelperText, SegmentedButtons, Text } from "react-native-paper";
import { recordWaterTest } from "../../api/facilities.js";
import { ReferenceMenu } from "../../components/reference-menu.js";
import { ScreenHeader } from "../../components/screen-header.js";
import { checkWaterTest } from "../../lib/water-test.js";

const SOURCES = [
  { id: "municipal", name: "Municipal" },
  { id: "borewell", name: "Borewell" },
  { id: "storage_tank", name: "Storage tank" },
  { id: "ro_plant", name: "RO plant" },
  { id: "dialysis", name: "Dialysis loop" },
];

const TEST_TYPES = [
  { value: "chemical", label: "Chemical" },
  { value: "microbiological", label: "Micro" },
  { value: "endotoxin", label: "Endotoxin" },
];

export function WaterTestScreen(): ReactNode {
  const [sourceType, setSourceType] = useState("dialysis");
  const [testType, setTestType] = useState("chemical");
  const [parameter, setParameter] = useState("");
  const [result, setResult] = useState("");
  const [unit, setUnit] = useState("");
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const [action, setAction] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const problems = checkWaterTest({
    parameter_name: parameter,
    result_value: result,
    acceptable_min: min,
    acceptable_max: max,
    corrective_action: action,
  });

  const toNumber = (raw: string) => (raw.trim() === "" ? undefined : Number(raw));

  const submit = async () => {
    if (!problems.canSubmit) {
      return;
    }
    setBusy(true);
    setFailure(null);
    try {
      await recordWaterTest({
        source_type: sourceType,
        test_type: testType,
        sample_date: new Date().toISOString().slice(0, 10),
        parameter_name: parameter.trim(),
        result_value: toNumber(result),
        unit: unit.trim() || undefined,
        acceptable_min: toNumber(min),
        acceptable_max: toNumber(max),
        // Derived, not asked. A tickbox that can disagree with the numbers
        // beside it is a record that contradicts itself.
        is_within_limits: problems.verdict === "within",
        corrective_action: action.trim() || undefined,
      });
      setSaved(true);
    } catch (cause) {
      setFailure(cause instanceof Error ? cause.message : "Could not record the test.");
    } finally {
      setBusy(false);
    }
  };

  if (saved) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.canvas }}>
        <ScreenHeader eyebrow="FACILITIES" title="Test recorded" />
        <View style={{ padding: SPACING.md, gap: SPACING.sm }}>
          <Text variant="bodyMedium" style={{ color: COLORS.ink }}>
            Logged against your name and today's date.
          </Text>
          <Button
            mode="contained"
            onPress={() => {
              setSaved(false);
              setParameter("");
              setResult("");
              setUnit("");
              setMin("");
              setMax("");
              setAction("");
            }}
            accessibilityLabel="Record another test"
          >
            Next test
          </Button>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.canvas }}>
      <ScreenHeader
        eyebrow="FACILITIES"
        title="Water test"
        description="Compliance is judged against the limits you enter."
      />
      <FormScrollView>
        <ReferenceMenu
          title="Source"
          rows={SOURCES}
          selectedId={sourceType}
          label={(row) => row.name}
          placeholder="Pick a source"
          onSelect={(row) => setSourceType(row.id)}
        />

        <Text variant="labelLarge" style={{ color: COLORS.ink, marginTop: SPACING.xs }}>
          Test type
        </Text>
        <SegmentedButtons
          value={testType}
          onValueChange={setTestType}
          buttons={TEST_TYPES.map((t) => ({
            value: t.value,
            label: t.label,
            accessibilityLabel: t.label,
          }))}
        />

        <MobileTextField
          label="Parameter"
          value={parameter}
          onChangeText={setParameter}
          placeholder="e.g. Endotoxin, pH, Chlorine"
          error={Boolean(problems.parameter)}
        />
        <HelperText type="error" visible={Boolean(problems.parameter)}>
          {problems.parameter ?? " "}
        </HelperText>

        <MobileTextField
          label="Result"
          value={result}
          onChangeText={setResult}
          keyboardType="decimal-pad"
          error={Boolean(problems.result)}
        />
        <HelperText type="error" visible={Boolean(problems.result)}>
          {problems.result ?? " "}
        </HelperText>

        <MobileTextField label="Unit (optional)" value={unit} onChangeText={setUnit} />

        <MobileTextField
          label="Acceptable minimum"
          value={min}
          onChangeText={setMin}
          keyboardType="decimal-pad"
        />
        <MobileTextField
          label="Acceptable maximum"
          value={max}
          onChangeText={setMax}
          keyboardType="decimal-pad"
        />
        <HelperText type="error" visible={Boolean(problems.limits)}>
          {problems.limits ?? " "}
        </HelperText>

        <Text
          variant="bodyMedium"
          style={{
            color: problems.verdict === "outside" ? COLORS.ink : COLORS.brandDeep,
            fontWeight: problems.verdict === "outside" ? "700" : "400",
          }}
        >
          {problems.verdict === "within" && "Within the limits you entered."}
          {problems.verdict === "outside" && "OUTSIDE the limits you entered."}
          {problems.verdict === "no_limits" &&
            "No limits entered — this result cannot be shown to comply."}
          {problems.verdict === "no_result" && "Enter a result to judge compliance."}
        </Text>

        {problems.verdict === "outside" && (
          <>
            <MobileTextField
              label="What was done about it"
              value={action}
              onChangeText={setAction}
              multiline
              numberOfLines={3}
              error={Boolean(problems.correctiveAction)}
            />
            <HelperText type="error" visible={Boolean(problems.correctiveAction)}>
              {problems.correctiveAction ?? " "}
            </HelperText>
          </>
        )}

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
          accessibilityLabel="Record this water test"
        >
          {busy ? "Recording…" : "Record test"}
        </Button>
      </FormScrollView>
    </View>
  );
}
