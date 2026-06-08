import { usePermissionStore } from "@medbrains/stores";
import type {
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
} from "@medbrains/types";
import { ScrollView, StyleSheet, View } from "react-native";
import { Button, Chip, Text } from "react-native-paper";
import {
  MOBILE_PATIENT_JOURNEY_BLOCKERS,
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
  icon: string;
  handoff: string;
}

interface MobileFlowBlocker {
  key: string;
  message: string;
  values?: ClinicalJourneyMessageValues;
  blockedReason: NonNullable<PatientFlowReadinessItem["blockedReason"]>;
}

const FLOW_VISUALS: Record<PatientFlowModule, FlowVisual> = {
  patient: { icon: "card-account-details", handoff: "Record" },
  opd: { icon: "stethoscope", handoff: "Clinic" },
  ipd: { icon: "bed", handoff: "Ward" },
  emergency: { icon: "ambulance", handoff: "ER" },
  camp: { icon: "account-group", handoff: "Camp" },
  pharmacy: { icon: "pill", handoff: "Rx" },
  billing: { icon: "receipt", handoff: "Bill" },
};

function mobileFlowBlocker(
  item: PatientFlowReadinessItem,
  context: ClinicalJourneyContext,
): MobileFlowBlocker | null {
  if (item.id === "opd" && !context.activeEncounterId) {
    return {
      blockedReason: "context",
      key: MOBILE_PATIENT_JOURNEY_BLOCKERS.openOpdEncounterBeforeMobileConsultation,
      message: "Open an OPD encounter before mobile consultation",
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
    return `Emits ${clinicalEventLabel(mobilePatientJourneyTranslator, item.emittedEvent)}`;
  }
  if (item.activationEvents.length > 0) {
    const events = clinicalEventList(mobilePatientJourneyTranslator, item.activationEvents);
    return journeyMessage(
      mobilePatientJourneyTranslator,
      "patientJourney.status.afterEvents",
      { events },
      [],
      `After ${events}`,
    );
  }
  return "Ready";
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
        navigation.navigate("PatientCareContext", {
          handoff: context.activeAdmissionId ? "open_admission" : "admit",
          module: "ipd",
          patientId: context.patientId,
        });
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
        navigation.navigate("PatientCareContext", {
          handoff: "open_context",
          module: "camp",
          patientId: context.patientId,
        });
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
          Flow Handoffs
        </Text>
        <View style={styles.summaryChips}>
          <Chip compact icon="check-circle" mode="outlined">
            {enabledCount}/{flowStates.length} ready
          </Chip>
          {blockedCount > 0 && (
            <Chip compact icon="lock-alert" mode="outlined">
              {blockedCount} blocked
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

          return (
            <View
              key={item.id}
              style={[
                styles.flowItem,
                isActive && styles.activeFlowItem,
                disabled && styles.blockedFlowItem,
              ]}
            >
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
                {visual.handoff}
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
