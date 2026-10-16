import { Group, Loader, Stack, Text } from "@mantine/core";
import { useHasAllPermissions } from "@medbrains/stores";
import type { MedicationSafetyFinding } from "@medbrains/types";
import { IconAlertTriangle, IconShieldCheck } from "@tabler/icons-react";
import { useMemo } from "react";
import { Alert, TextArea } from "@/components/ui";
import {
  MIN_OVERRIDE_REASON,
  overridePermissions,
  type SafetyGate,
  safetyGate,
} from "./safetyGate";

export interface SafetyGateState extends SafetyGate {
  loading: boolean;
  failed: boolean;
  canOverride: boolean;
}

/** The pharmacy safety gate for one screen: the findings, and whether this user may proceed. */
export function useSafetyGate(
  findings: readonly MedicationSafetyFinding[] | undefined,
  opts: { loading: boolean; failed: boolean; reason: string },
): SafetyGateState {
  const required = useMemo(() => overridePermissions(findings ?? []), [findings]);
  const canOverride = useHasAllPermissions(required);
  // Loaded but carrying no findings at all means the check did not run.
  const failed = opts.failed || (!opts.loading && !findings);
  const gate = safetyGate(findings, {
    checked: !opts.loading && !failed,
    canOverride,
    reason: opts.reason,
  });
  return { ...gate, loading: opts.loading, failed, canOverride };
}

const TITLES: Record<string, string> = {
  DRUG_ALLERGY_CONFLICT: "Documented drug allergy",
  DRUG_INTERACTION: "Drug-drug interaction",
  RESERVE_ANTIBIOTIC_APPROVAL_REQUIRED: "Reserve antibiotic — stewardship approval",
  NON_FORMULARY_APPROVAL_REQUIRED: "Not on the formulary",
};

interface Props {
  state: SafetyGateState;
  /** When given, a block offers an override reason to holders of the permission. */
  reason?: string;
  onReasonChange?: (reason: string) => void;
}

/**
 * What the server's medication safety check found for this prescription or
 * order — allergy, drug-drug interaction, Reserve antibiotic stewardship and
 * formulary. A check that could not run says so; it never reads as clear.
 */
export function SafetyFindingsPanel({ state, reason, onReasonChange }: Props) {
  if (state.loading) {
    return (
      <Group gap="xs">
        <Loader size="xs" />
        <Text size="sm">Running medication safety checks…</Text>
      </Group>
    );
  }
  if (state.failed) {
    return (
      <Alert tone="danger" icon={<IconAlertTriangle size={16} />} title="Safety checks did not run">
        This is a fault, not a clean result. Do not approve or dispense until the allergy,
        interaction, stewardship and formulary checks have run.
      </Alert>
    );
  }
  const findings = [...state.blocks, ...state.warnings];
  if (findings.length === 0) {
    return (
      <Alert tone="success" icon={<IconShieldCheck size={16} />}>
        No allergy, interaction, stewardship or formulary issues found.
      </Alert>
    );
  }
  return (
    <Stack gap="xs">
      {findings.map((f) => (
        <Alert
          key={`${f.code}-${f.message}`}
          tone={f.severity === "block" ? "danger" : "warning"}
          icon={<IconAlertTriangle size={16} />}
          title={`${f.severity === "block" ? "Blocks" : "Caution"}: ${TITLES[f.code] ?? f.code}`}
        >
          {f.message}
        </Alert>
      ))}
      {state.needsReason && onReasonChange && state.canOverride && (
        <TextArea
          label="Override reason"
          description="Recorded against this prescription and the safety audit."
          required
          value={reason ?? ""}
          onChange={(e) => onReasonChange(e.currentTarget.value)}
          error={
            (reason ?? "").trim().length < MIN_OVERRIDE_REASON
              ? `Give a clinical reason (at least ${MIN_OVERRIDE_REASON} characters).`
              : undefined
          }
        />
      )}
      {state.needsReason && !state.canOverride && (
        <Text size="sm">
          Only a pharmacist with override rights for these findings can proceed. Put the
          prescription on hold and contact the prescriber.
        </Text>
      )}
    </Stack>
  );
}
