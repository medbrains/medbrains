/**
 * Walk the fire round, scanning each extinguisher.
 *
 * A fire round means going to every unit in the building. Finding the right
 * record by name is how the wrong one gets signed off — a hospital has dozens
 * of "Corridor Extinguisher" — so the tag on the unit is scanned instead. Fire
 * equipment already carries `barcode_value` and `qr_code_value`; nothing was
 * reading them.
 *
 * The status is computed from dates rather than judgement, so unlike the gas
 * screen this one does state an opinion: an extinguisher past its expiry or
 * refill date is out of date by arithmetic. Equipment with no dates recorded
 * reads "unknown" rather than "ok", because unproven is not the same as good.
 */

import { BarcodeScanner } from "@medbrains/mobile-shell";
import type { IntentTone } from "@medbrains/ui-mobile";
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
import { View } from "react-native";
import { Button, HelperText, SegmentedButtons, Text } from "react-native-paper";
import type { FireEquipmentRow } from "../../api/facilities.js";
import { listFireEquipment, recordFireInspection } from "../../api/facilities.js";
import { EntityRow } from "../../components/entity-row.js";
import { ScreenHeader } from "../../components/screen-header.js";
import {
  type FireStatus,
  fireStatus,
  inspectionProblem,
  isBlocking,
} from "../../lib/fire-check.js";
import { useFetch } from "../../lib/use-fetch.js";

const STATUS_TONE: Record<FireStatus, IntentTone> = {
  expired: "alert",
  refill_due: "warn",
  unknown: "warn",
  ok: "success",
};

const STATUS_LABEL: Record<FireStatus, string> = {
  expired: "expired",
  refill_due: "refill overdue",
  unknown: "no dates on record",
  ok: "in date",
};

type Stage =
  | { kind: "scanning" }
  | { kind: "unknown"; code: string }
  | { kind: "found"; equipment: FireEquipmentRow }
  | { kind: "recorded"; equipment: FireEquipmentRow };

export function FireRoundScreen(): ReactNode {
  const { data, loading, error, refetch } = useFetch(listFireEquipment, []);
  const [stage, setStage] = useState<Stage>({ kind: "scanning" });
  const [scanRound, setScanRound] = useState(0);
  const [functional, setFunctional] = useState("yes");
  const [findings, setFindings] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  /** Map, not a scan of the list — this runs on every decoded frame. */
  const byTag = useMemo(() => {
    const index = new Map<string, FireEquipmentRow>();
    for (const item of data ?? []) {
      for (const tag of [item.barcode_value, item.qr_code_value]) {
        if (tag) {
          index.set(tag.trim().toUpperCase(), item);
        }
      }
    }
    return index;
  }, [data]);

  const handleScan = useCallback(
    (value: string) => {
      const match = byTag.get(value.trim().toUpperCase());
      setFailure(null);
      setStage(match ? { kind: "found", equipment: match } : { kind: "unknown", code: value });
    },
    [byTag],
  );

  const scanNext = useCallback(() => {
    setStage({ kind: "scanning" });
    setFunctional("yes");
    setFindings("");
    setFailure(null);
    setScanRound((round) => round + 1);
  }, []);

  const problem = inspectionProblem({ is_functional: functional === "yes", findings });

  const record = useCallback(
    async (equipment: FireEquipmentRow) => {
      if (problem) {
        return;
      }
      setBusy(true);
      setFailure(null);
      try {
        await recordFireInspection({
          equipment_id: equipment.id,
          inspection_date: today,
          is_functional: functional === "yes",
          findings: findings.trim() || undefined,
        });
        setStage({ kind: "recorded", equipment });
      } catch (cause) {
        setFailure(cause instanceof Error ? cause.message : "Could not record the check.");
      } finally {
        setBusy(false);
      }
    },
    [findings, functional, problem, today],
  );

  if (loading) {
    return (
      <Frame>
        <View style={{ alignItems: "center", paddingVertical: SPACING.lg }}>
          <EcgLoader />
        </View>
      </Frame>
    );
  }

  if (error) {
    return (
      <Frame>
        <Empty
          title="Couldn't load the equipment list"
          description={error}
          actionLabel="Retry"
          onAction={refetch}
        />
      </Frame>
    );
  }

  if (stage.kind === "scanning") {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.canvas }}>
        <BarcodeScanner
          title="Scan the tag on the unit"
          hint={`${byTag.size} tagged units on the round`}
          onScan={handleScan}
          resumeKey={scanRound}
        />
      </View>
    );
  }

  return (
    <Frame>
      <FormScrollView>
        {failure && (
          <HelperText type="error" visible accessibilityRole="alert">
            {failure}
          </HelperText>
        )}

        {stage.kind === "unknown" && (
          <>
            <Badge tone="alert" label="Not on the round" />
            <Text variant="bodyMedium" style={{ color: COLORS.ink, opacity: 0.85 }}>
              No active equipment carries the tag {stage.code}. Either this unit was never
              registered, or its tag belongs to something retired. Do not sign it off — an
              unregistered extinguisher is one nobody is maintaining.
            </Text>
          </>
        )}

        {stage.kind === "found" && (
          <FoundEquipment
            equipment={stage.equipment}
            today={today}
            functional={functional}
            setFunctional={setFunctional}
            findings={findings}
            setFindings={setFindings}
            problem={problem}
            busy={busy}
            onRecord={() => record(stage.equipment)}
          />
        )}

        {stage.kind === "recorded" && (
          <>
            <Badge tone="success" label="Checked" />
            <Text variant="titleMedium" style={{ color: COLORS.ink }}>
              {stage.equipment.name} recorded
            </Text>
          </>
        )}

        <Button mode="outlined" onPress={scanNext} accessibilityLabel="Scan the next unit">
          Scan the next unit
        </Button>
      </FormScrollView>
    </Frame>
  );
}

function FoundEquipment({
  equipment,
  today,
  functional,
  setFunctional,
  findings,
  setFindings,
  problem,
  busy,
  onRecord,
}: {
  equipment: FireEquipmentRow;
  today: string;
  functional: string;
  setFunctional: (value: string) => void;
  findings: string;
  setFindings: (value: string) => void;
  problem: string | null;
  busy: boolean;
  onRecord: () => void;
}): ReactNode {
  const status = fireStatus(equipment, today);

  return (
    <>
      <EntityRow
        title={equipment.name}
        subtitle={`${equipment.equipment_type.replace(/_/g, " ")}${
          equipment.capacity ? ` · ${equipment.capacity}` : ""
        }${equipment.serial_number ? ` · ${equipment.serial_number}` : ""}`}
        accent={isBlocking(status)}
        badge={{ label: STATUS_LABEL[status], tone: STATUS_TONE[status] }}
      />

      {isBlocking(status) && (
        <Text variant="bodySmall" style={{ color: COLORS.ink, opacity: 0.85 }}>
          {status === "unknown"
            ? "No expiry or refill date is recorded, so this unit cannot be shown to be serviceable. Raise it with the fire officer."
            : "This unit is out of date. Record the check, then raise a work order — an inspector will ask why it is still mounted."}
        </Text>
      )}

      <Text variant="labelLarge" style={{ color: COLORS.ink, marginTop: SPACING.xs }}>
        Is it serviceable
      </Text>
      <SegmentedButtons
        value={functional}
        onValueChange={setFunctional}
        buttons={[
          { value: "yes", label: "Yes", accessibilityLabel: "Serviceable" },
          { value: "no", label: "No", accessibilityLabel: "Not serviceable" },
        ]}
      />

      <MobileTextField
        label={functional === "no" ? "What is wrong" : "Findings (optional)"}
        value={findings}
        onChangeText={setFindings}
        multiline
        numberOfLines={3}
        error={Boolean(problem)}
      />
      <HelperText type="error" visible={Boolean(problem)}>
        {problem ?? " "}
      </HelperText>

      <Button
        mode="contained"
        onPress={onRecord}
        loading={busy}
        disabled={busy || Boolean(problem)}
        accessibilityLabel={`Record the check for ${equipment.name}`}
      >
        {busy ? "Recording…" : "Record check"}
      </Button>
    </>
  );
}

function Frame({ children }: { children: ReactNode }): ReactNode {
  return (
    <View style={{ flex: 1, backgroundColor: COLORS.canvas }}>
      <ScreenHeader
        eyebrow="FACILITIES"
        title="Fire round"
        description="Scan each unit. Checks are logged against your name."
      />
      {children}
    </View>
  );
}
