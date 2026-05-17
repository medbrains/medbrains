/**
 * Bedside action form for common nurse charting tasks. Kept local to
 * the nurse module so each write stays patient/admission-scoped.
 */

import { Badge, Card, COLORS, MobileTextField, SPACING } from "@medbrains/ui-mobile";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import { Button, Text } from "react-native-paper";
import type { AdmissionRow } from "../../api/ipd.js";
import {
  createFallRisk,
  createIoEntry,
  createPainEntry,
  createVitalsReading,
  getIoBalance,
} from "../../api/ipd.js";
import { ScreenHeader } from "../../components/screen-header.js";
import type { BedsideActionMode } from "./patient-workspace.js";

export interface BedsideActionScreenProps {
  admission: AdmissionRow;
  mode: BedsideActionMode;
}

type Direction = "intake" | "output";

export function BedsideActionScreen({ admission, mode }: BedsideActionScreenProps): ReactNode {
  const [form, setForm] = useState<Record<string, string>>({});
  const [direction, setDirection] = useState<Direction>("intake");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const spec = useMemo(() => actionSpec(mode), [mode]);

  const setField = (key: string, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (mode === "vitals") {
        await submitVitals(admission.encounter_id, form);
      }
      if (mode === "io") {
        await createIoEntry({
          encounter_id: admission.encounter_id,
          category: requiredText(form.category, "Category"),
          direction,
          volume_ml: requiredInt(form.volume_ml, "Volume"),
          notes: optionalText(form.notes),
        });
        const balance = await getIoBalance(admission.encounter_id);
        setMessage(`Saved. 8h balance: ${balance.balance} ml`);
        return;
      }
      if (mode === "pain") {
        await createPainEntry({
          encounter_id: admission.encounter_id,
          scale: "numeric",
          score: boundedInt(form.score, "Pain score", 0, 10),
          location: optionalText(form.location),
          character: optionalText(form.character),
          intervention_taken: optionalText(form.intervention),
          notes: optionalText(form.notes),
        });
      }
      if (mode === "fall-risk") {
        const score = requiredInt(form.score, "Fall risk score");
        await createFallRisk({
          encounter_id: admission.encounter_id,
          scale: "morse",
          score,
          risk_level: fallRiskLevel(score),
          interventions: buildFallInterventions(form.interventions),
        });
      }
      setMessage("Saved to bedside chart.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save entry");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.canvas }}>
      <ScreenHeader
        eyebrow="NURSE"
        title={spec.title}
        description={`${admission.patient_name} · UHID ${admission.uhid}`}
        trailing={<Badge label={spec.badge} tone={spec.tone} />}
      />
      <ScrollView contentContainerStyle={{ padding: SPACING.md, gap: SPACING.sm }}>
        <Card
          eyebrow="CONTEXT"
          title={admission.bed_label ?? "Active admission"}
          pattern="clinical"
        >
          <Text variant="bodyMedium" style={{ color: COLORS.ink }}>
            This entry is linked to encounter {admission.encounter_id.slice(0, 8)} for audit and
            shift handover continuity.
          </Text>
        </Card>

        {mode === "vitals" && (
          <>
            <MobileTextField
              label="Temperature"
              keyboardType="decimal-pad"
              value={form.temperature ?? ""}
              onChangeText={(v) => setField("temperature", v)}
              placeholder="98.6"
            />
            <MobileTextField
              label="Pulse"
              keyboardType="number-pad"
              value={form.pulse ?? ""}
              onChangeText={(v) => setField("pulse", v)}
              placeholder="76"
            />
            <View style={{ flexDirection: "row", gap: SPACING.sm }}>
              <MobileTextField
                label="Systolic BP"
                keyboardType="number-pad"
                value={form.systolic_bp ?? ""}
                onChangeText={(v) => setField("systolic_bp", v)}
                containerStyle={{ flex: 1 }}
              />
              <MobileTextField
                label="Diastolic BP"
                keyboardType="number-pad"
                value={form.diastolic_bp ?? ""}
                onChangeText={(v) => setField("diastolic_bp", v)}
                containerStyle={{ flex: 1 }}
              />
            </View>
            <View style={{ flexDirection: "row", gap: SPACING.sm }}>
              <MobileTextField
                label="SpO2"
                keyboardType="number-pad"
                value={form.spo2 ?? ""}
                onChangeText={(v) => setField("spo2", v)}
                containerStyle={{ flex: 1 }}
              />
              <MobileTextField
                label="Respiratory rate"
                keyboardType="number-pad"
                value={form.respiratory_rate ?? ""}
                onChangeText={(v) => setField("respiratory_rate", v)}
                containerStyle={{ flex: 1 }}
              />
            </View>
            <MobileTextField
              label="Notes"
              multiline
              value={form.notes ?? ""}
              onChangeText={(v) => setField("notes", v)}
            />
          </>
        )}

        {mode === "io" && (
          <>
            <View style={{ flexDirection: "row", gap: SPACING.sm }}>
              <Button
                mode={direction === "intake" ? "contained" : "outlined"}
                onPress={() => setDirection("intake")}
                style={{ flex: 1 }}
              >
                Intake
              </Button>
              <Button
                mode={direction === "output" ? "contained" : "outlined"}
                onPress={() => setDirection("output")}
                style={{ flex: 1 }}
              >
                Output
              </Button>
            </View>
            <MobileTextField
              label="Category"
              required
              value={form.category ?? ""}
              onChangeText={(v) => setField("category", v)}
              placeholder={direction === "intake" ? "oral / IV / tube" : "urine / drain / emesis"}
            />
            <MobileTextField
              label="Volume ml"
              required
              keyboardType="number-pad"
              value={form.volume_ml ?? ""}
              onChangeText={(v) => setField("volume_ml", v)}
            />
            <MobileTextField
              label="Notes"
              multiline
              value={form.notes ?? ""}
              onChangeText={(v) => setField("notes", v)}
            />
          </>
        )}

        {mode === "pain" && (
          <>
            <MobileTextField
              label="Pain score 0-10"
              required
              keyboardType="number-pad"
              value={form.score ?? ""}
              onChangeText={(v) => setField("score", v)}
            />
            <MobileTextField
              label="Location"
              value={form.location ?? ""}
              onChangeText={(v) => setField("location", v)}
            />
            <MobileTextField
              label="Character"
              value={form.character ?? ""}
              onChangeText={(v) => setField("character", v)}
              placeholder="dull / sharp / burning"
            />
            <MobileTextField
              label="Intervention"
              multiline
              value={form.intervention ?? ""}
              onChangeText={(v) => setField("intervention", v)}
            />
          </>
        )}

        {mode === "fall-risk" && (
          <>
            <MobileTextField
              label="Morse score"
              required
              keyboardType="number-pad"
              value={form.score ?? ""}
              onChangeText={(v) => setField("score", v)}
            />
            <MobileTextField
              label="Interventions"
              multiline
              value={form.interventions ?? ""}
              onChangeText={(v) => setField("interventions", v)}
              placeholder="bed low, call bell, non-skid socks"
            />
          </>
        )}

        {error && <Text style={{ color: COLORS.red }}>{error}</Text>}
        {message && <Text style={{ color: COLORS.brand }}>{message}</Text>}
        <Button mode="contained" loading={busy} disabled={busy} onPress={submit}>
          Save
        </Button>
      </ScrollView>
    </View>
  );
}

function actionSpec(mode: BedsideActionMode): {
  title: string;
  badge: string;
  tone: "info" | "success" | "warn";
} {
  if (mode === "io") return { title: "Intake / output", badge: "I/O", tone: "success" };
  if (mode === "pain") return { title: "Pain score", badge: "PAIN", tone: "warn" };
  if (mode === "fall-risk") return { title: "Fall risk", badge: "FALL", tone: "info" };
  return { title: "Vitals", badge: "VITALS", tone: "info" };
}

async function submitVitals(encounterId: string, form: Record<string, string>) {
  const values = {
    temperature: optionalDecimal(form.temperature),
    pulse: optionalBoundedInt(form.pulse, "Pulse", 0, 300),
    systolic_bp: optionalBoundedInt(form.systolic_bp, "Systolic BP", 0, 300),
    diastolic_bp: optionalBoundedInt(form.diastolic_bp, "Diastolic BP", 0, 200),
    respiratory_rate: optionalBoundedInt(form.respiratory_rate, "Respiratory rate", 0, 80),
    spo2: optionalBoundedInt(form.spo2, "SpO2", 0, 100),
    notes: optionalText(form.notes),
  };
  const hasReading = Object.entries(values).some(
    ([key, value]) => key !== "notes" && value != null,
  );
  if (!hasReading) {
    throw new Error("Enter at least one vital reading");
  }
  await createVitalsReading({ encounter_id: encounterId, ...values });
}

function optionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function requiredText(value: string | undefined, label: string): string {
  const trimmed = optionalText(value);
  if (!trimmed) throw new Error(`${label} is required`);
  return trimmed;
}

function requiredInt(value: string | undefined, label: string): number {
  const parsed = Number.parseInt(requiredText(value, label), 10);
  if (!Number.isFinite(parsed)) throw new Error(`${label} must be a number`);
  return parsed;
}

function boundedInt(value: string | undefined, label: string, min: number, max: number): number {
  const parsed = requiredInt(value, label);
  if (parsed < min || parsed > max) throw new Error(`${label} must be ${min}-${max}`);
  return parsed;
}

function optionalBoundedInt(
  value: string | undefined,
  label: string,
  min: number,
  max: number,
): number | undefined {
  if (!optionalText(value)) return undefined;
  return boundedInt(value, label, min, max);
}

function optionalDecimal(value: string | undefined): string | undefined {
  const trimmed = optionalText(value);
  if (!trimmed) return undefined;
  const parsed = Number.parseFloat(trimmed);
  if (!Number.isFinite(parsed)) throw new Error("Decimal value is invalid");
  return trimmed;
}

function fallRiskLevel(score: number): string {
  if (score >= 45) return "high";
  if (score >= 25) return "moderate";
  return "low";
}

function buildFallInterventions(value: string | undefined): string[] {
  return (
    optionalText(value)
      ?.split(",")
      .map((item) => item.trim())
      .filter(Boolean) ?? []
  );
}
