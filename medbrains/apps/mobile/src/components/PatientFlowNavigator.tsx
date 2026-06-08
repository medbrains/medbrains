import { usePermissionStore } from "@medbrains/stores";
import type {
  ClinicalJourneyActionSignal,
  ClinicalJourneyActionSignalTone,
  ClinicalJourneyContext,
  ClinicalJourneyMessageValues,
  PatientFlowModule,
  PatientFlowReadinessItem,
} from "@medbrains/types";
import {
  buildPatientFlowReadiness,
  clinicalEventLabel,
  clinicalEventList,
  journeyBlockedReasonLabel,
  journeyMessage,
  patientFlowItemDisabledReason,
  patientFlowItemLabel,
  patientFlowReadinessSignal,
} from "@medbrains/types";
import { ScrollView, StyleSheet, View } from "react-native";
import { Button, Chip, Text } from "react-native-paper";
import {
  mobileCampCareContextParams,
  mobileIpdCareContextParams,
} from "../navigation/careContextParams";
import { MEDBRAINS_COLORS } from "../theme/paper-theme";
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
type MobileFlowSignalTone = ClinicalJourneyActionSignalTone;

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

function flowSignalColors(tone: MobileFlowSignalTone) {
  switch (tone) {
    case "risk":
      return {
        background: MEDBRAINS_COLORS.statusDangerBg,
        border: MEDBRAINS_COLORS.statusDanger,
        text: MEDBRAINS_COLORS.statusDanger,
      };
    case "active":
      return {
        background: MEDBRAINS_COLORS.navActiveBg,
        border: MEDBRAINS_COLORS.statusInfo,
        text: MEDBRAINS_COLORS.statusInfo,
      };
    case "ready":
      return {
        background: MEDBRAINS_COLORS.statusSuccessBg,
        border: MEDBRAINS_COLORS.statusSuccess,
        text: MEDBRAINS_COLORS.statusSuccess,
      };
    case "blocked":
      return {
        background: MEDBRAINS_COLORS.statusWarningBg,
        border: MEDBRAINS_COLORS.statusWarning,
        text: MEDBRAINS_COLORS.statusWarning,
      };
    default:
      return {
        background: MEDBRAINS_COLORS.navActiveBg,
        border: MEDBRAINS_COLORS.muted,
        text: MEDBRAINS_COLORS.muted,
      };
  }
}

function flowSignalStyle(signal: MobileFlowReadinessSignal) {
  const colors = flowSignalColors(signal.tone);
  const size = signal.emphasis === "high" ? 15 : 12;
  const base = {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderWidth: signal.emphasis === "high" ? 2 : 1.5,
    height: size,
    width: signal.shape === "pill" ? size + 13 : size,
  };

  switch (signal.shape) {
    case "diamond":
      return { ...base, borderRadius: 3, transform: [{ rotate: "45deg" }] };
    case "pill":
      return { ...base, borderRadius: 999 };
    case "token":
      return { ...base, borderRadius: 4 };
    default:
      return { ...base, borderRadius: 4 };
  }
}

function FlowReadinessShape({
  label,
  signal,
}: {
  label: string;
  signal: MobileFlowReadinessSignal;
}) {
  return <View accessibilityLabel={label} style={flowSignalStyle(signal)} />;
}

function flowSignalLabel(blockedReason: PatientFlowReadinessItem["blockedReason"]) {
  return (
    journeyBlockedReasonLabel(mobilePatientJourneyTranslator, blockedReason) ??
    mobilePatientJourneyText(MOBILE_PATIENT_JOURNEY_TEXT.status.ready)
  );
}

function mobileBillingParams(context: ClinicalJourneyContext) {
  return {
    admissionId: context.activeAdmissionId ?? undefined,
    encounterId: context.activeAdmissionId ? undefined : (context.activeEncounterId ?? undefined),
    patientId: context.patientId,
  };
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

    switch (item.id) {
      case "patient":
        navigation.navigate("PatientDetail", { patientId: context.patientId });
        return;
      case "opd":
        navigation.navigate("ConsultationNotes", {
          encounterId: context.activeEncounterId ?? "",
          patientId: context.patientId,
        });
        return;
      case "ipd":
        navigation.navigate("PatientCareContext", mobileIpdCareContextParams(context));
        return;
      case "emergency":
        navigation.navigate("PatientCareContext", {
          erVisitId: context.activeEmergencyVisitId ?? undefined,
          handoff: "open_visit",
          module: "emergency",
          patientId: context.patientId,
        });
        return;
      case "camp":
        navigation.navigate("PatientCareContext", mobileCampCareContextParams(context));
        return;
      case "pharmacy":
        navigation.navigate("PatientPharmacy", {
          handoff: "queue",
          patientId: context.patientId,
          pharmacyOrderId: context.activePharmacyOrderId ?? undefined,
          pharmacyRxQueueId: context.activePharmacyRxQueueId ?? undefined,
        });
        return;
      case "billing":
        if (context.activeInvoiceId) {
          navigation.navigate("BillDetail", {
            invoiceId: context.activeInvoiceId,
          });
          return;
        }
        navigation.navigate("Billing", {
          filter: "all",
          ...mobileBillingParams(context),
        });
        return;
    }
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
          const signalColors = flowSignalColors(signal.tone);
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
