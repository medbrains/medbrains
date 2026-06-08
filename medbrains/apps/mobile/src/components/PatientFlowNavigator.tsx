import { usePermissionStore } from "@medbrains/stores";
import type {
  ClinicalJourneyContext,
  PatientFlowModule,
  PatientFlowReadinessItem,
} from "@medbrains/types";
import { buildPatientFlowReadiness } from "@medbrains/types";
import { ScrollView, StyleSheet, View } from "react-native";
import { Button, Chip, Text } from "react-native-paper";

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

const FLOW_VISUALS: Record<PatientFlowModule, FlowVisual> = {
  patient: { icon: "card-account-details", handoff: "Record" },
  opd: { icon: "stethoscope", handoff: "Clinic" },
  ipd: { icon: "bed", handoff: "Ward" },
  emergency: { icon: "ambulance", handoff: "ER" },
  camp: { icon: "account-group", handoff: "Camp" },
  pharmacy: { icon: "pill", handoff: "Rx" },
  billing: { icon: "receipt", handoff: "Bill" },
};

function eventLabel(eventName: string) {
  return eventName.replace(/\./g, " ");
}

function blockedReasonLabel(reason: PatientFlowReadinessItem["blockedReason"]) {
  switch (reason) {
    case "context":
      return "Context";
    case "event":
      return "Event";
    case "permission":
      return "Permission";
    default:
      return null;
  }
}

function mobileFlowDisabledReason(
  item: PatientFlowReadinessItem,
  context: ClinicalJourneyContext,
): string | null {
  if (item.disabledReason) return item.disabledReason;

  if (item.id === "opd" && !context.activeEncounterId) {
    return "Open an OPD encounter from the queue";
  }

  return null;
}

function readinessText(item: PatientFlowReadinessItem, disabledReason: string | null) {
  if (disabledReason) {
    const blockedLabel = blockedReasonLabel(item.blockedReason);
    return blockedLabel ? `${blockedLabel}: ${disabledReason}` : disabledReason;
  }
  if (item.emittedEvent) return `Emits ${eventLabel(item.emittedEvent)}`;
  if (item.activationEvents.length > 0) {
    return `After ${item.activationEvents.map(eventLabel).join(" / ")}`;
  }
  return "Ready";
}

export function PatientFlowNavigator({
  active = "patient",
  context,
  navigation,
}: PatientFlowNavigatorProps) {
  const hasPermission = usePermissionStore((state) => state.hasPermission);
  const { items } = buildPatientFlowReadiness(context, hasPermission, "mobile");
  const flowStates = items.map((item) => ({
    disabledReason: mobileFlowDisabledReason(item, context),
    item,
  }));
  const enabledCount = flowStates.filter((state) => !state.disabledReason).length;
  const blockedCount = flowStates.length - enabledCount;

  function handleFlowPress(item: PatientFlowReadinessItem) {
    if (mobileFlowDisabledReason(item, context)) return;

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
          patientId: context.patientId,
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
        {flowStates.map(({ disabledReason, item }) => {
          const visual = FLOW_VISUALS[item.id];
          const disabled = Boolean(disabledReason);
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
                {item.label}
              </Button>
              <Text variant="labelSmall" style={styles.handoff}>
                {visual.handoff}
              </Text>
              <Text variant="labelSmall" style={styles.reason}>
                {readinessText(item, disabledReason)}
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
