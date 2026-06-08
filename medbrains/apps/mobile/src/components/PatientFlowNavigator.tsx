import { usePermissionStore } from "@medbrains/stores";
import type {
  ClinicalJourneyActionSignal,
  ClinicalJourneyContext,
  ClinicalJourneyMessageValues,
  PatientFlowModule,
  PatientFlowReadinessItem,
  PatientJourneyMobileTarget,
} from "@medbrains/types";
import {
  buildPatientFlowReadiness,
  clinicalEventLabel,
  clinicalEventList,
  journeyBlockedReasonLabel,
  journeyMessage,
  patientFlowItemDisabledReason,
  patientFlowItemLabel,
  patientFlowMobileTarget,
  patientFlowReadinessSignal,
} from "@medbrains/types";
import { WorkflowSignalMarker, workflowSignalColors } from "@medbrains/ui-mobile";
import { ScrollView, StyleSheet, View } from "react-native";
import { Button, Chip, Text } from "react-native-paper";
import {
  MOBILE_PATIENT_JOURNEY_BLOCKERS,
  MOBILE_PATIENT_JOURNEY_TEXT,
  mobilePatientJourneyText,
  mobilePatientJourneyTranslator,
} from "./patientJourneyText";

interface PatientFlowNavigatorProps {
  active?: PatientFlowModule;
  context: ClinicalJourneyContext;
  navigation: {
    navigate: (screen: string, params?: Record<string, unknown>) => void;
  };
}

interface FlowVisual {
  handoffKey: string;
  icon: string;
}

interface MobileFlowBlocker {
  key: string;
  message: string;
  values?: ClinicalJourneyMessageValues;
  blockedReason: NonNullable<PatientFlowReadinessItem["blockedReason"]>;
}

type MobileFlowReadinessSignal = ClinicalJourneyActionSignal;

const FLOW_VISUALS: Record<PatientFlowModule, FlowVisual> = {
  patient: {
    icon: "card-account-details",
    handoffKey: MOBILE_PATIENT_JOURNEY_TEXT.flow.handoffs.patient,
  },
  opd: { icon: "stethoscope", handoffKey: MOBILE_PATIENT_JOURNEY_TEXT.flow.handoffs.opd },
  ipd: { icon: "bed", handoffKey: MOBILE_PATIENT_JOURNEY_TEXT.flow.handoffs.ipd },
  emergency: {
    icon: "ambulance",
    handoffKey: MOBILE_PATIENT_JOURNEY_TEXT.flow.handoffs.emergency,
  },
  camp: { icon: "account-group", handoffKey: MOBILE_PATIENT_JOURNEY_TEXT.flow.handoffs.camp },
  pharmacy: { icon: "pill", handoffKey: MOBILE_PATIENT_JOURNEY_TEXT.flow.handoffs.pharmacy },
  billing: { icon: "receipt", handoffKey: MOBILE_PATIENT_JOURNEY_TEXT.flow.handoffs.billing },
};

function mobileFlowBlocker(
  item: PatientFlowReadinessItem,
  context: ClinicalJourneyContext,
): MobileFlowBlocker | null {
  if (item.id === "opd" && !context.activeEncounterId) {
    return {
      blockedReason: "context",
      key: MOBILE_PATIENT_JOURNEY_BLOCKERS.openOpdEncounterBeforeMobileConsultation,
      message: mobilePatientJourneyText(
        MOBILE_PATIENT_JOURNEY_BLOCKERS.openOpdEncounterBeforeMobileConsultation,
      ),
    };
  }

  return null;
}

function mobileFlowDisabledReason(
  item: PatientFlowReadinessItem,
  mobileBlocker: MobileFlowBlocker | null,
): string | null {
  if (mobileBlocker) {
    return journeyMessage(
      mobilePatientJourneyTranslator,
      mobileBlocker.key,
      mobileBlocker.values ?? null,
      item.activationEvents,
      mobileBlocker.message,
    );
  }

  return patientFlowItemDisabledReason(mobilePatientJourneyTranslator, item);
}

function readinessText(
  item: PatientFlowReadinessItem,
  blockedReason: PatientFlowReadinessItem["blockedReason"],
  disabledReason: string | null,
) {
  if (disabledReason) {
    const blockedLabel = journeyBlockedReasonLabel(mobilePatientJourneyTranslator, blockedReason);
    return blockedLabel ? `${blockedLabel}: ${disabledReason}` : disabledReason;
  }
  if (item.emittedEvent) {
    return mobilePatientJourneyText(MOBILE_PATIENT_JOURNEY_TEXT.status.emitsEvent, {
      event: clinicalEventLabel(mobilePatientJourneyTranslator, item.emittedEvent),
    });
  }
  if (item.activationEvents.length > 0) {
    const events = clinicalEventList(mobilePatientJourneyTranslator, item.activationEvents);
    return journeyMessage(
      mobilePatientJourneyTranslator,
      "patientJourney.status.afterEvents",
      { events },
      [],
      mobilePatientJourneyText("patientJourney.status.afterEvents", { events }),
    );
  }
  return mobilePatientJourneyText(MOBILE_PATIENT_JOURNEY_TEXT.status.ready);
}

function FlowReadinessShape({
  label,
  signal,
}: {
  label: string;
  signal: MobileFlowReadinessSignal;
}) {
  return (
    <WorkflowSignalMarker
      accessibilityLabel={label}
      emphasis={signal.emphasis}
      pillExtension={13}
      shape={signal.shape}
      size={signal.emphasis === "high" ? 15 : 12}
      tone={signal.tone}
    />
  );
}

function flowSignalLabel(blockedReason: PatientFlowReadinessItem["blockedReason"]) {
  return (
    journeyBlockedReasonLabel(mobilePatientJourneyTranslator, blockedReason) ??
    mobilePatientJourneyText(MOBILE_PATIENT_JOURNEY_TEXT.status.ready)
  );
}

function navigateMobileTarget(
  navigation: PatientFlowNavigatorProps["navigation"],
  target: PatientJourneyMobileTarget,
) {
  navigation.navigate(target.screen, target.params);
}

export function PatientFlowNavigator({
  active = "patient",
  context,
  navigation,
}: PatientFlowNavigatorProps) {
  const hasPermission = usePermissionStore((state) => state.hasPermission);
  const { items } = buildPatientFlowReadiness(context, hasPermission, "mobile");
  const flowStates = items.map((item) => {
    const mobileBlocker = mobileFlowBlocker(item, context);
    const disabledReason = mobileFlowDisabledReason(item, mobileBlocker);
    return {
      blockedReason: mobileBlocker?.blockedReason ?? item.blockedReason,
      disabledReason,
      enabled: item.enabled && !mobileBlocker,
      item,
    };
  });
  const enabledCount = flowStates.filter((state) => state.enabled).length;
  const blockedCount = flowStates.length - enabledCount;

  function handleFlowPress(item: PatientFlowReadinessItem) {
    if (!flowStates.find((state) => state.item.id === item.id)?.enabled) return;

    navigateMobileTarget(navigation, patientFlowMobileTarget(item.id, context));
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text variant="titleSmall" style={styles.title}>
          {mobilePatientJourneyText(MOBILE_PATIENT_JOURNEY_TEXT.flow.title)}
        </Text>
        <View style={styles.summaryChips}>
          <Chip compact icon="check-circle" mode="outlined">
            {mobilePatientJourneyText(MOBILE_PATIENT_JOURNEY_TEXT.summary.readyCount, {
              enabled: enabledCount,
              total: flowStates.length,
            })}
          </Chip>
          {blockedCount > 0 && (
            <Chip compact icon="lock-alert" mode="outlined">
              {mobilePatientJourneyText(MOBILE_PATIENT_JOURNEY_TEXT.summary.blockedCount, {
                count: blockedCount,
              })}
            </Chip>
          )}
        </View>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.flowRail}
      >
        {flowStates.map(({ blockedReason, disabledReason, enabled, item }) => {
          const visual = FLOW_VISUALS[item.id];
          const disabled = !enabled;
          const isActive = active === item.id;
          const signal = patientFlowReadinessSignal({ blockedReason, enabled });
          const signalColors = workflowSignalColors(signal.tone);
          const signalLabel = flowSignalLabel(blockedReason);

          return (
            <View
              key={item.id}
              style={[
                styles.flowItem,
                isActive && styles.activeFlowItem,
                disabled && styles.blockedFlowItem,
              ]}
            >
              <View style={styles.flowStateRow}>
                <FlowReadinessShape label={signalLabel} signal={signal} />
                <Text
                  variant="labelSmall"
                  style={[styles.flowStateText, { color: signalColors.text }]}
                >
                  {signalLabel}
                </Text>
              </View>
              <Button
                mode={isActive ? "contained" : "contained-tonal"}
                icon={visual.icon}
                disabled={disabled}
                onPress={() => handleFlowPress(item)}
                compact
              >
                {patientFlowItemLabel(mobilePatientJourneyTranslator, item)}
              </Button>
              <Text variant="labelSmall" style={styles.handoff}>
                {mobilePatientJourneyText(visual.handoffKey)}
              </Text>
              <Text variant="labelSmall" style={styles.reason}>
                {readinessText(item, blockedReason, disabledReason)}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },
  title: {
    fontWeight: "700",
  },
  summaryChips: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    justifyContent: "flex-end",
  },
  flowRail: {
    gap: 10,
    paddingRight: 2,
  },
  flowItem: {
    gap: 4,
    minHeight: 92,
    width: 132,
  },
  flowStateRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    minHeight: 18,
  },
  flowStateText: {
    fontWeight: "700",
  },
  activeFlowItem: {
    opacity: 1,
  },
  blockedFlowItem: {
    opacity: 0.66,
  },
  handoff: {
    fontWeight: "700",
    opacity: 0.76,
  },
  reason: {
    opacity: 0.62,
  },
});
