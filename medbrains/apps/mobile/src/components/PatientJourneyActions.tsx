import { useAuthStore } from "@medbrains/stores";
import type {
  ClinicalJourneyActionId,
  ClinicalJourneyContext,
  ResolvedClinicalJourneyAction,
} from "@medbrains/types";
import { ROLE_TEMPLATES, resolveClinicalJourneyActions } from "@medbrains/types";
import { StyleSheet, View } from "react-native";
import { Button, Text } from "react-native-paper";

type MobileJourneyActionId =
  | "billing.collect_payment"
  | "billing.open_ledger"
  | "opd.open_visit"
  | "orders.lab"
  | "orders.medication";

interface PatientJourneyActionsProps {
  context: ClinicalJourneyContext;
  navigation: {
    navigate: (screen: string, params?: Record<string, unknown>) => void;
  };
}

const SUPPORTED_MOBILE_ACTIONS = new Set<ClinicalJourneyActionId>([
  "billing.collect_payment",
  "billing.open_ledger",
  "opd.open_visit",
  "orders.medication",
  "orders.lab",
]);

function actionIcon(actionId: ClinicalJourneyActionId) {
  switch (actionId) {
    case "billing.collect_payment":
      return "credit-card";
    case "billing.open_ledger":
      return "receipt";
    case "opd.open_visit":
      return "stethoscope";
    case "orders.medication":
      return "pill";
    case "orders.lab":
      return "flask";
    default:
      return "arrow-right";
  }
}

function actionLabel(action: ResolvedClinicalJourneyAction & { id: MobileJourneyActionId }) {
  if (action.id === "billing.collect_payment") return "Payment";
  if (action.id === "billing.open_ledger") return "Billing";
  if (action.id === "opd.open_visit") return "Notes";
  return action.shortLabel;
}

function eventLabel(eventName: string) {
  return eventName.replace(/\./g, " ");
}

function roleHasPermission(role: string | null | undefined, code: string) {
  if (role === "super_admin" || role === "hospital_admin") return true;
  if (!role) return false;
  return Boolean(ROLE_TEMPLATES[role]?.permissions.includes(code));
}

function supportedAction(
  action: ResolvedClinicalJourneyAction,
): action is ResolvedClinicalJourneyAction & { id: MobileJourneyActionId } {
  return SUPPORTED_MOBILE_ACTIONS.has(action.id);
}

function mobileDisabledReason(
  action: ResolvedClinicalJourneyAction & { id: MobileJourneyActionId },
  context: ClinicalJourneyContext,
) {
  if (action.id === "opd.open_visit" && !context.activeEncounterId) {
    return "Open an OPD encounter before mobile consultation";
  }
  return action.disabledReasonText;
}

export function PatientJourneyActions({ context, navigation }: PatientJourneyActionsProps) {
  const userRole = useAuthStore((state) => state.user?.role);
  const actions = resolveClinicalJourneyActions(
    context,
    (permission) => roleHasPermission(userRole, permission),
    "mobile",
  ).filter(supportedAction);

  function handleAction(action: ResolvedClinicalJourneyAction & { id: MobileJourneyActionId }) {
    if (mobileDisabledReason(action, context)) return;

    switch (action.id) {
      case "billing.collect_payment":
        navigation.navigate("Billing", {
          filter: "pending",
          handoff: "payment",
          patientId: context.patientId,
        });
        return;
      case "billing.open_ledger":
        navigation.navigate("Billing", {
          filter: "all",
          patientId: context.patientId,
        });
        return;
      case "opd.open_visit":
        navigation.navigate("ConsultationNotes", {
          encounterId: context.activeEncounterId ?? "",
          patientId: context.patientId,
        });
        return;
      case "orders.medication":
        navigation.navigate("Prescription", {
          encounterId: context.activeEncounterId,
          patientId: context.patientId,
        });
        return;
      case "orders.lab":
        navigation.navigate("LabOrder", {
          encounterId: context.activeEncounterId,
          patientId: context.patientId,
        });
        return;
    }
  }

  if (actions.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text variant="titleSmall" style={styles.title}>
          Patient Flow
        </Text>
      </View>
      <View style={styles.actions}>
        {actions.map((action) => {
          const disabledReason = mobileDisabledReason(action, context);
          return (
            <View key={action.id} style={styles.actionBlock}>
              <Button
                mode={action.intent === "primary" ? "contained" : "outlined"}
                icon={actionIcon(action.id)}
                disabled={Boolean(disabledReason)}
                onPress={() => handleAction(action)}
                compact
              >
                {actionLabel(action)}
              </Button>
              <Text variant="labelSmall" style={styles.reason}>
                {disabledReason ?? `After ${action.activatesAfter.map(eventLabel).join(" / ")}`}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
  },
  header: {
    flexDirection: "row",
    marginBottom: 12,
  },
  title: {
    fontWeight: "700",
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  actionBlock: {
    minWidth: 118,
    flexGrow: 1,
    gap: 4,
  },
  reason: {
    opacity: 0.6,
  },
});
