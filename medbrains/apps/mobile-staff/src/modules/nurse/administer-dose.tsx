/**
 * Nurse → give one dose at the bedside, with the 5 rights actually checked.
 *
 * The BCMA endpoint has existed and been enforced since the eMAR shipped: the
 * server refuses a high-alert administration whose `barcode_verified` is false,
 * and only `POST /api/nurse/mar/{id}/verify-barcode` can set it. The web
 * AdministerModal has always called it. **The phone never did** — it posted
 * `barcode_verified: false` and hoped. So the wrong-patient / wrong-drug guard
 * existed everywhere except the device carried to the bed, which is the only
 * place a wristband can be scanned.
 *
 * Two scans, in this order: the wristband on the arm, then the drug in the
 * hand. Nothing the camera reads is trusted — both strings go to the server,
 * which compares them against the admission's UHID and the ordered catalogue
 * item, checks the batch has not expired, and answers. A client that could
 * stamp `barcode_verified` itself would be a client that could skip the check.
 *
 * The mismatch cases are the point of the screen, not its error handling.
 * "Wrong patient", "wrong drug" and "expired batch" are three different things
 * to do next, and the server names which one so the nurse is not left to guess.
 */

import { BarcodeScanner, useAuthStore } from "@medbrains/mobile-shell";
import { Badge, COLORS, EcgLoader, MobileTextField, SPACING } from "@medbrains/ui-mobile";
import type { ReactNode } from "react";
import { useCallback, useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import { Button, HelperText, RadioButton, Text } from "react-native-paper";
import type { AdmissionRow, BarcodeVerifyResult, MarRow, WardOnDutyRow } from "../../api/ipd.js";
import { updateMar, verifyMarBarcode, wardOnDuty } from "../../api/ipd.js";
import { useModuleRouter } from "../../components/module-router.js";
import { ScreenHeader } from "../../components/screen-header.js";
import { useFetch } from "../../lib/use-fetch.js";
import { canRecordGiven, eligibleWitnesses, scanRightsSummary } from "./bcma.js";

/** WCAG 2.2 SC 2.5.8 and the mobile surface rules both put the floor at 44. */
const TAP_TARGET = 44;

type Step =
  | { kind: "wristband" }
  | { kind: "drug"; patientBarcode: string }
  | { kind: "verified" }
  | { kind: "refused"; result: BarcodeVerifyResult };

export interface AdministerDoseScreenProps {
  admission: AdmissionRow;
  dose: MarRow;
}

export function AdministerDoseScreen({ admission, dose }: AdministerDoseScreenProps): ReactNode {
  const router = useModuleRouter();
  // Back to the MAR, which refetches on mount — the dose the nurse just
  // recorded has to be visibly gone, or they will record it again.
  const onDone = useCallback(() => router.pop(), [router]);
  const [step, setStep] = useState<Step>({ kind: "wristband" });
  const [scanRound, setScanRound] = useState(0);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const handleScan = useCallback(
    async (value: string) => {
      const scanned = value.trim();
      setFailure(null);
      if (step.kind === "wristband") {
        setStep({ kind: "drug", patientBarcode: scanned });
        setScanRound((round) => round + 1);
        return;
      }
      if (step.kind !== "drug") {
        return;
      }
      setBusy(true);
      try {
        const result = await verifyMarBarcode(dose.id, step.patientBarcode, scanned);
        setStep(result.verified ? { kind: "verified" } : { kind: "refused", result });
      } catch (err) {
        // A failed check and a failed request are not the same event. Falling
        // back to "not verified" here would tell a nurse the wristband is wrong
        // when the truth is that nobody asked.
        setFailure(
          err instanceof Error
            ? `The check could not be completed: ${err.message}`
            : "The check could not be completed.",
        );
        setStep({ kind: "wristband" });
      } finally {
        setBusy(false);
        setScanRound((round) => round + 1);
      }
    },
    [dose.id, step],
  );

  const rescan = useCallback(() => {
    setFailure(null);
    setStep({ kind: "wristband" });
    setScanRound((round) => round + 1);
  }, []);

  return (
    <ScrollView style={{ backgroundColor: COLORS.canvas, flex: 1 }}>
      <ScreenHeader
        eyebrow="ADMINISTER"
        title={dose.drug_name}
        description={`${dose.dose} · ${dose.route} · ${admission.patient_name} · UHID ${admission.uhid}`}
        trailing={dose.is_high_alert ? <Badge label="high alert" tone="alert" /> : undefined}
      />

      {failure && (
        <HelperText type="error" visible accessibilityRole="alert">
          {failure}
        </HelperText>
      )}

      {(step.kind === "wristband" || step.kind === "drug") && (
        <View style={{ height: 420 }}>
          <BarcodeScanner
            hint={
              step.kind === "wristband"
                ? "The band on the patient's arm, not the chart or the bed label."
                : "The barcode on the pack you are about to give."
            }
            onScan={handleScan}
            resumeKey={scanRound}
            title={step.kind === "wristband" ? "Scan the wristband" : "Scan the drug"}
          />
        </View>
      )}

      {busy && (
        <View style={{ alignItems: "center", paddingVertical: SPACING.lg }}>
          <EcgLoader />
        </View>
      )}

      {step.kind === "refused" && <ScanRefused onRescan={rescan} result={step.result} />}

      {step.kind === "verified" && (
        <RecordAdministration admission={admission} dose={dose} onDone={onDone} />
      )}

      <View style={{ padding: SPACING.md }}>
        <RecordNotGiven admission={admission} dose={dose} onDone={onDone} />
      </View>
    </ScrollView>
  );
}

/**
 * A refusal is a full stop, not a warning with a way past it.
 *
 * There is deliberately no "give anyway" here. The server would refuse a
 * high-alert dose regardless, and offering the button for the rest would teach
 * the habit on the doses where it is merely dangerous rather than blocked.
 */
function ScanRefused({
  onRescan,
  result,
}: {
  onRescan: () => void;
  result: BarcodeVerifyResult;
}): ReactNode {
  return (
    <View
      style={{
        backgroundColor: COLORS.panel,
        borderColor: COLORS.red,
        borderLeftWidth: 6,
        borderWidth: 1,
        gap: SPACING.sm,
        margin: SPACING.md,
        padding: SPACING.md,
      }}
    >
      <Text variant="titleMedium" style={{ color: COLORS.red }}>
        Do not give this dose
      </Text>
      <Text style={{ color: COLORS.ink }}>
        {result.reason ?? "The scan did not match this order."}
      </Text>
      <Text style={{ color: COLORS.muted }}>{scanRightsSummary(result)}</Text>
      <Button
        accessibilityLabel="Scan the wristband and drug again"
        mode="outlined"
        onPress={onRescan}
        style={{ justifyContent: "center", minHeight: TAP_TARGET }}
      >
        Scan again
      </Button>
    </View>
  );
}

/** The give step, reachable only once the server has stamped the verification. */
function RecordAdministration({
  admission,
  dose,
  onDone,
}: {
  admission: AdmissionRow;
  dose: MarRow;
  onDone: () => void;
}): ReactNode {
  const actorId = useAuthStore((state) => state.identity?.userId ?? "");
  const [witnessId, setWitnessId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const wardId = admission.ward_id ?? null;
  const { data: onDuty, error: onDutyError } = useFetch(
    () => (wardId ? wardOnDuty(wardId) : Promise.resolve([] as WardOnDutyRow[])),
    [wardId],
  );

  // The administering nurse cannot witness their own high-alert dose — the
  // server rejects it, so offering the name here would only produce a refusal
  // after the tap.
  const witnesses = useMemo(() => eligibleWitnesses(onDuty ?? [], actorId), [onDuty, actorId]);

  const give = useCallback(async () => {
    setBusy(true);
    setFailure(null);
    try {
      await updateMar(admission.id, dose.id, {
        status: "given",
        administered_at: new Date().toISOString(),
        witnessed_by: dose.is_high_alert ? (witnessId ?? undefined) : undefined,
      });
      onDone();
    } catch (err) {
      setFailure(err instanceof Error ? err.message : "The dose could not be recorded.");
    } finally {
      setBusy(false);
    }
  }, [admission.id, dose.id, dose.is_high_alert, witnessId, onDone]);

  return (
    <View style={{ gap: SPACING.sm, padding: SPACING.md }}>
      <Text variant="titleMedium" style={{ color: COLORS.emerald }}>
        Right patient, right drug
      </Text>

      {dose.is_high_alert && (
        <View style={{ gap: SPACING.xs }}>
          <Text style={{ color: COLORS.ink }}>
            A high-alert drug takes a second nurse. Pick who checked it with you.
          </Text>
          {/* Unknown must not look like "nobody is on duty": one leaves the
              nurse waiting for a name, the other sends them to the station. */}
          {onDutyError ? (
            <HelperText type="error" visible accessibilityRole="alert">
              The on-duty list could not be loaded, so a witness cannot be picked here. Record this
              dose at the station.
            </HelperText>
          ) : witnesses.length === 0 ? (
            <HelperText type="info" visible>
              No other nurse is recorded on duty for this ward today.
            </HelperText>
          ) : (
            <RadioButton.Group onValueChange={setWitnessId} value={witnessId ?? ""}>
              {witnesses.map((nurse) => (
                <RadioButton.Item
                  key={nurse.nurse_user_id}
                  label={nurse.is_charge ? `${nurse.nurse_name} (charge)` : nurse.nurse_name}
                  style={{ minHeight: TAP_TARGET }}
                  value={nurse.nurse_user_id}
                />
              ))}
            </RadioButton.Group>
          )}
        </View>
      )}

      {failure && (
        <HelperText type="error" visible accessibilityRole="alert">
          {failure}
        </HelperText>
      )}

      <Button
        accessibilityLabel={`Record ${dose.drug_name} as given`}
        disabled={busy || !canRecordGiven({ isHighAlert: dose.is_high_alert, witnessId })}
        loading={busy}
        mode="contained"
        onPress={give}
        style={{ justifyContent: "center", minHeight: TAP_TARGET }}
      >
        Give now
      </Button>
    </View>
  );
}

/**
 * Held and refused, with a reason the nurse actually typed.
 *
 * The old bedside path sent the constant strings "Held by bedside nurse" and
 * "Patient refused" to satisfy the server's "a reason is required" rule. That
 * turns a clinical record into a checkbox: a held dose whose reason is a
 * literal tells the next shift nothing, and the doctor reviewing why a dose was
 * skipped learns only that somebody skipped it.
 */
function RecordNotGiven({
  admission,
  dose,
  onDone,
}: {
  admission: AdmissionRow;
  dose: MarRow;
  onDone: () => void;
}): ReactNode {
  const [mode, setMode] = useState<"held" | "refused" | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const submit = useCallback(async () => {
    if (!mode || reason.trim().length === 0) {
      return;
    }
    setBusy(true);
    setFailure(null);
    try {
      await updateMar(admission.id, dose.id, {
        status: mode,
        hold_reason: mode === "held" ? reason.trim() : undefined,
        refused_reason: mode === "refused" ? reason.trim() : undefined,
      });
      onDone();
    } catch (err) {
      setFailure(err instanceof Error ? err.message : "The dose could not be recorded.");
    } finally {
      setBusy(false);
    }
  }, [admission.id, dose.id, mode, reason, onDone]);

  if (mode === null) {
    return (
      <View style={{ flexDirection: "row", gap: SPACING.sm }}>
        <Button
          accessibilityLabel={`Hold ${dose.drug_name} and give a reason`}
          mode="outlined"
          onPress={() => setMode("held")}
          style={{ justifyContent: "center", minHeight: TAP_TARGET }}
        >
          Hold
        </Button>
        <Button
          accessibilityLabel={`Record that the patient refused ${dose.drug_name}`}
          mode="outlined"
          onPress={() => setMode("refused")}
          style={{ justifyContent: "center", minHeight: TAP_TARGET }}
        >
          Refused
        </Button>
      </View>
    );
  }

  return (
    <View style={{ gap: SPACING.sm }}>
      <MobileTextField
        accessibilityLabel={mode === "held" ? "Why the dose was held" : "Why the patient refused"}
        label={mode === "held" ? "Why was it held?" : "What did the patient say?"}
        multiline
        onChangeText={setReason}
        value={reason}
      />
      {failure && (
        <HelperText type="error" visible accessibilityRole="alert">
          {failure}
        </HelperText>
      )}
      <View style={{ flexDirection: "row", gap: SPACING.sm }}>
        <Button
          accessibilityLabel="Save this reason"
          disabled={busy || reason.trim().length === 0}
          loading={busy}
          mode="contained"
          onPress={submit}
          style={{ justifyContent: "center", minHeight: TAP_TARGET }}
        >
          Save
        </Button>
        <Button
          accessibilityLabel="Cancel"
          mode="text"
          onPress={() => {
            setMode(null);
            setReason("");
          }}
          style={{ justifyContent: "center", minHeight: TAP_TARGET }}
        >
          Cancel
        </Button>
      </View>
    </View>
  );
}
