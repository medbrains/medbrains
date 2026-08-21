/**
 * Nurse → MAR schedule for an admission.
 *
 * The list is the schedule; giving a dose happens on the bedside screen, which
 * scans the wristband and the drug first. This screen used to write the
 * administration itself with `barcode_verified: false`, and used to satisfy the
 * server's "a reason is required" rule for hold and refusal with two constant
 * strings — a clinical record that says nothing to the next shift. Both moved
 * to `administer-dose`, where a human is asked.
 */

import { Badge, COLORS, EcgLoader, Empty, SPACING } from "@medbrains/ui-mobile";
import type { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { Button, Text } from "react-native-paper";
import type { AdmissionRow, MarRow, MarStatus } from "../../api/ipd.js";
import { listMar } from "../../api/ipd.js";
import { useModuleRouter } from "../../components/module-router.js";
import { ScreenHeader } from "../../components/screen-header.js";
import { useFetch } from "../../lib/use-fetch.js";

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

/** WCAG 2.2 SC 2.5.8 and the mobile surface rules both put the floor at 44. */
const TAP_TARGET = 44;

export function MarScheduleScreen({ admission }: MarScheduleScreenProps): ReactNode {
  const router = useModuleRouter();
  const { data, loading, error, refetch } = useFetch(() => listMar(admission.id), [admission.id]);

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.canvas }}>
      <ScreenHeader
        testID="screen-mar"
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
              onAdminister={() => router.push("administer", { admission, dose })}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function DoseRow({ dose, onAdminister }: { dose: MarRow; onAdminister: () => void }): ReactNode {
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
        <View style={{ marginTop: SPACING.sm }}>
          <Button
            accessibilityLabel={`Take ${dose.drug_name} to the bedside and scan`}
            testID="mar-take-to-bedside"
            mode="contained"
            onPress={onAdminister}
            style={{ justifyContent: "center", minHeight: TAP_TARGET }}
          >
            Take to bedside
          </Button>
        </View>
      )}
    </View>
  );
}
