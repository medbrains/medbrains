/**
 * Report a device that has stopped working, from where it stands.
 *
 * The person who finds a failed infusion pump is the nurse at the bedside, not
 * the engineer in the workshop. Until now they had to find a terminal, which is
 * why breakdowns get reported at the end of a shift, or verbally, or not at
 * all — and a pump nobody reported is one still plugged into the next patient.
 *
 * Downtime is stamped at report time. The clock that matters is when the device
 * stopped being usable, not when somebody reached a keyboard.
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
import { useMemo, useState } from "react";
import { View } from "react-native";
import { Button, HelperText, SegmentedButtons, Text } from "react-native-paper";
import { listEquipment, reportBreakdown } from "../../api/bme.js";
import { ReferenceMenu } from "../../components/reference-menu.js";
import { ScreenHeader } from "../../components/screen-header.js";
import {
  type BreakdownPriority,
  checkBreakdown,
  needsImmediateSwap,
  PRIORITY_MEANING,
} from "../../lib/breakdown.js";
import { useFetch } from "../../lib/use-fetch.js";

const PRIORITIES: BreakdownPriority[] = ["critical", "high", "medium", "low"];

const PRIORITY_LABEL: Record<BreakdownPriority, string> = {
  critical: "Critical",
  high: "High",
  medium: "Today",
  low: "Later",
};

export function ReportBreakdownScreen(): ReactNode {
  const { data, loading, error, refetch } = useFetch(() => listEquipment(), []);
  const [equipmentId, setEquipmentId] = useState<string | null>(null);
  const [priority, setPriority] = useState<BreakdownPriority>("high");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const equipment = useMemo(() => data ?? [], [data]);
  const problems = checkBreakdown({ equipmentId, priority, description });

  const submit = async () => {
    if (!problems.canSubmit || !equipmentId) {
      return;
    }
    setBusy(true);
    setFailure(null);
    try {
      await reportBreakdown({
        equipment_id: equipmentId,
        priority,
        description: description.trim(),
        downtime_start: new Date().toISOString(),
      });
      setSaved(true);
    } catch (cause) {
      setFailure(cause instanceof Error ? cause.message : "Could not report the breakdown.");
    } finally {
      setBusy(false);
    }
  };

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
          title="Couldn't load equipment"
          description={error}
          actionLabel="Retry"
          onAction={refetch}
        />
      </Frame>
    );
  }

  if (saved) {
    return (
      <Frame>
        <View style={{ padding: SPACING.md, gap: SPACING.sm }}>
          <Badge tone="success" label="Reported" />
          <Text variant="bodyMedium" style={{ color: COLORS.ink }}>
            Biomedical can see it, and downtime is counted from now.
          </Text>
          <Button
            mode="contained"
            onPress={() => {
              setSaved(false);
              setEquipmentId(null);
              setDescription("");
              setPriority("high");
            }}
            accessibilityLabel="Report another breakdown"
          >
            Report another
          </Button>
        </View>
      </Frame>
    );
  }

  return (
    <Frame>
      <FormScrollView>
        <ReferenceMenu
          title="Which device"
          rows={equipment}
          selectedId={equipmentId ?? ""}
          label={(row) =>
            `${row.name}${row.asset_tag ? ` · ${row.asset_tag}` : ""}${
              row.serial_number ? ` · ${row.serial_number}` : ""
            }`
          }
          placeholder="Pick the device"
          onSelect={(row) => setEquipmentId(row.id)}
          onClear={() => setEquipmentId(null)}
        />
        <HelperText type="error" visible={Boolean(problems.equipment)}>
          {problems.equipment ?? " "}
        </HelperText>

        <Text variant="labelLarge" style={{ color: COLORS.ink }}>
          How urgent
        </Text>
        <SegmentedButtons
          value={priority}
          onValueChange={(value) => setPriority(value as BreakdownPriority)}
          buttons={PRIORITIES.map((p) => ({
            value: p,
            label: PRIORITY_LABEL[p],
            accessibilityLabel: PRIORITY_MEANING[p],
          }))}
        />
        <Text variant="bodySmall" style={{ color: COLORS.brandDeep, opacity: 0.8 }}>
          {PRIORITY_MEANING[priority]}
        </Text>

        {needsImmediateSwap(priority) && (
          <Text variant="bodyMedium" style={{ color: COLORS.ink, fontWeight: "700" }}>
            Swap the device before anything else. Reporting it does not take it out of service.
          </Text>
        )}

        <MobileTextField
          label="What is it doing"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          error={Boolean(problems.description)}
        />
        <HelperText type="error" visible={Boolean(problems.description)}>
          {problems.description ?? " "}
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
          disabled={busy || !problems.canSubmit}
          accessibilityLabel="Report this breakdown"
        >
          {busy ? "Reporting…" : "Report breakdown"}
        </Button>
      </FormScrollView>
    </Frame>
  );
}

function Frame({ children }: { children: ReactNode }): ReactNode {
  return (
    <View style={{ flex: 1, backgroundColor: COLORS.canvas }}>
      <ScreenHeader
        eyebrow="BIOMEDICAL"
        title="Report a breakdown"
        description="Downtime counts from when you report it."
      />
      {children}
    </View>
  );
}
