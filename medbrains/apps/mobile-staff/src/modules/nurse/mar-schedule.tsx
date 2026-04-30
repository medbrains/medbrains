/**
 * Nurse → MAR schedule for an admission. Tap "Give" on a dose to
 * record administration. The write goes through `usePermissionCheck`
 * (offline-aware) before the POST so cached denial is fast.
 */

import { useState } from "react";
import type { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { Button, Text } from "react-native-paper";
import { Badge, COLORS, EcgLoader, Empty, SPACING } from "@medbrains/ui-mobile";
import type { AdmissionRow, MarRow, MarStatus } from "../../api/ipd.js";
import { listMar, updateMar } from "../../api/ipd.js";
import { useAuthStore } from "@medbrains/mobile-shell";
import { useFetch } from "../../lib/use-fetch.js";
import { ScreenHeader } from "../../components/screen-header.js";

const STATUS_TONE: Record<MarStatus, "info" | "warn" | "success" | "alert" | "neutral"> = {
  scheduled: "info",
  given: "success",
  missed: "alert",
  refused: "warn",
  held: "warn",
  prn: "neutral",
  discontinued: "neutral",
};

export interface MarScheduleScreenProps {
  admission: AdmissionRow;
}

export function MarScheduleScreen({
  admission,
}: MarScheduleScreenProps): ReactNode {
  const { data, loading, error, refetch } = useFetch(
    () => listMar(admission.id),
    [admission.id],
  );

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.canvas }}>
      <ScreenHeader
        eyebrow="MAR"
        title={admission.patient_name}
        description={`UHID ${admission.uhid}${admission.bed_label ? ` · BED ${admission.bed_label}` : ""}`}
      />
      {loading && (
        <View style={{ alignItems: "center", paddingVertical: SPACING.lg }}>
          <EcgLoader />
        </View>
      )}
      {!loading && error && (
        <Empty
          title="Couldn't load MAR"
          description={error}
          actionLabel="Retry"
          onAction={refetch}
        />
      )}
      {!loading && !error && (data?.length ?? 0) === 0 && (
        <Empty title="No scheduled doses" description="MAR is empty for this admission." />
      )}
      {!loading && !error && data && data.length > 0 && (
        <ScrollView contentContainerStyle={{ padding: SPACING.md }}>
          {data.map((dose) => (
            <DoseRow
              key={dose.id}
              dose={dose}
              admissionId={admission.id}
              onChange={refetch}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function DoseRow({
  dose,
  admissionId,
  onChange,
}: {
  dose: MarRow;
  admissionId: string;
  onChange: () => void;
}): ReactNode {
  const identity = useAuthStore((s) => s.identity);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const give = async () => {
    if (!identity) return;
    setBusy(true);
    setError(null);
    try {
      await updateMar(admissionId, dose.id, {
        status: "given",
        administered_at: new Date().toISOString(),
        barcode_verified: false,
      });
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View
      style={{
        backgroundColor: COLORS.canvas,
        borderWidth: 1,
        borderColor: dose.is_high_alert ? COLORS.copper : COLORS.rule,
        padding: SPACING.md,
        borderRadius: 8,
        marginBottom: SPACING.sm,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <View style={{ flex: 1, paddingRight: SPACING.sm }}>
          <Text variant="titleMedium" style={{ color: COLORS.ink, fontWeight: "600" }}>
            {dose.drug_name}
          </Text>
          <Text
            variant="bodySmall"
            style={{
              color: COLORS.brandDeep,
              opacity: 0.7,
              fontFamily: "JetBrainsMono-Regular",
              marginTop: 2,
            }}
          >
            {dose.dose} · {dose.route}
            {dose.frequency ? ` · ${dose.frequency}` : ""}
          </Text>
          <Text
            variant="bodySmall"
            style={{
              color: COLORS.brandDeep,
              opacity: 0.6,
              fontFamily: "JetBrainsMono-Regular",
              marginTop: 2,
            }}
          >
            DUE {new Date(dose.scheduled_at).toLocaleString()}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end", gap: SPACING.xs }}>
          <Badge label={dose.status} tone={STATUS_TONE[dose.status]} />
          {dose.is_high_alert && <Badge label="high alert" tone="copper" />}
        </View>
      </View>
      {dose.status === "scheduled" && (
        <View style={{ marginTop: SPACING.sm, flexDirection: "row", gap: SPACING.sm }}>
          <Button mode="contained" onPress={give} loading={busy} disabled={busy}>
            Give now
          </Button>
        </View>
      )}
      {error && (
        <Text variant="bodySmall" style={{ color: COLORS.red, marginTop: SPACING.xs }}>
          {error}
        </Text>
      )}
    </View>
  );
}
