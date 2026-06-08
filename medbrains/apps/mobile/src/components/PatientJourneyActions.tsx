import { usePermissionStore } from "@medbrains/stores";
import type {
  ClinicalJourneyActionId,
  ClinicalJourneyBlockedReason,
  ClinicalJourneyContext,
  ResolvedClinicalJourneyAction,
} from "@medbrains/types";
import {
  P,
  resolveClinicalJourneyActions,
  summarizeClinicalJourneyActions,
} from "@medbrains/types";
import { StyleSheet, View } from "react-native";
import { Button, Chip, Text } from "react-native-paper";

type MobileJourneyActionId =
  | "billing.collect_payment"
  | "billing.open_ledger"
  | "billing.prepare_discharge_bill"
  | "camp.open_context"
  | "emergency.open_mlc"
  | "emergency.open_visit"
  | "ipd.admit"
  | "ipd.open_admission"
  | "opd.open_visit"
  | "orders.lab"
  | "orders.medication"
  | "orders.radiology"
  | "pharmacy.dispense_order"
  | "pharmacy.open_patient_queue";

interface PatientJourneyActionsProps {
  context: ClinicalJourneyContext;
  navigation: {
    navigate: (screen: string, params?: Record<string, unknown>) => void;
  };
  showUnavailable?: boolean;
}

const SUPPORTED_MOBILE_ACTIONS = new Set<ClinicalJourneyActionId>([
  "billing.collect_payment",
  "billing.open_ledger",
  "billing.prepare_discharge_bill",
  "camp.open_context",
  "emergency.open_mlc",
  "emergency.open_visit",
  "ipd.admit",
  "ipd.open_admission",
  "opd.open_visit",
  "orders.medication",
  "orders.lab",
  "orders.radiology",
  "pharmacy.dispense_order",
  "pharmacy.open_patient_queue",
]);

function actionIcon(actionId: ClinicalJourneyActionId) {
  switch (actionId) {
    case "billing.collect_payment":
      return "credit-card";
    case "billing.open_ledger":
    case "billing.prepare_discharge_bill":
      return "receipt";
    case "camp.open_context":
      return "account-group";
    case "emergency.open_mlc":
      return "file-alert";
    case "emergency.open_visit":
      return "ambulance";
    case "ipd.admit":
    case "ipd.open_admission":
      return "bed";
    case "opd.open_visit":
      return "stethoscope";
    case "orders.medication":
      return "pill";
    case "orders.lab":
      return "flask";
    case "orders.radiology":
      return "radioactive";
    case "pharmacy.dispense_order":
    case "pharmacy.open_patient_queue":
      return "pill";
    default:
      return "arrow-right";
  }
}

function actionLabel(action: ResolvedClinicalJourneyAction & { id: MobileJourneyActionId }) {
  if (action.id === "billing.collect_payment") return "Payment";
  if (action.id === "billing.open_ledger") return "Billing";
  if (action.id === "billing.prepare_discharge_bill") return "Discharge Bill";
  if (action.id === "camp.open_context") return "Camp";
  if (action.id === "emergency.open_mlc") return "MLC";
  if (action.id === "emergency.open_visit") return "ER";
  if (action.id === "ipd.admit") return "Admit";
  if (action.id === "ipd.open_admission") return "IPD";
  if (action.id === "opd.open_visit") return "Notes";
  if (action.id === "orders.radiology") return "Imaging";
  if (action.id === "pharmacy.dispense_order") return "Dispense";
  if (action.id === "pharmacy.open_patient_queue") return "Pharmacy";
  return action.shortLabel;
}

function eventLabel(eventName: string) {
  return eventName.replace(/\./g, " ");
}

function blockedReasonLabel(reason: ClinicalJourneyBlockedReason | null) {
  switch (reason) {
    case "configuration":
      return "Configuration";
    case "context":
      return "Context";
    case "event":
      return "Event";
    case "masking":
      return "Masking";
    case "permission":
      return "Permission";
    case "regulatory":
      return "Regulatory";
    default:
      return null;
  }
}

function actionActivationText(action: ResolvedClinicalJourneyAction) {
  return action.activatesAfter.length > 0
    ? `After ${action.activatesAfter.map(eventLabel).join(" / ")}`
    : "Available";
}

function supportedAction(
  action: ResolvedClinicalJourneyAction,
): action is ResolvedClinicalJourneyAction & { id: MobileJourneyActionId } {
  return SUPPORTED_MOBILE_ACTIONS.has(action.id);
}

function mobileDisabledReason(
  action: ResolvedClinicalJourneyAction & { id: MobileJourneyActionId },
  context: ClinicalJourneyContext,
  hasPermission: (permission: string) => boolean,
) {
  if (action.disabledReasonText) return action.disabledReasonText;

  const hasMobileOrderContext =
    (context.activeOrderContext === "opd" && Boolean(context.activeEncounterId)) ||
    (context.activeOrderContext === "ipd" &&
      Boolean(context.activeAdmissionId) &&
      Boolean(context.activeEncounterId));

  if (
    action.id === "opd.open_visit" &&
    (!context.activeEncounterId || context.activeOrderContext !== "opd")
  ) {
    return "Open an OPD encounter before mobile consultation";
  }
  if (
    (action.id === "orders.medication" ||
      action.id === "orders.lab" ||
      action.id === "orders.radiology") &&
    !hasMobileOrderContext
  ) {
    return context.activeOrderContext === "ipd"
      ? "Open an active IPD encounter before mobile inpatient orders"
      : "Open an OPD encounter before mobile orders";
  }
  if (
    action.id === "orders.radiology" &&
    (!hasPermission(P.RADIOLOGY.ORDERS_CREATE) || !hasPermission(P.RADIOLOGY.ORDERS_LIST))
  ) {
    return "Radiology order permission required";
  }
  return null;
}

function mobileOrderParams(context: ClinicalJourneyContext) {
  return {
    admissionId: context.activeAdmissionId ?? undefined,
    encounterId: context.activeEncounterId,
    orderContext: context.activeOrderContext ?? undefined,
    patientId: context.patientId,
  };
}

function applyMobileDisabledReason(
  action: ResolvedClinicalJourneyAction & { id: MobileJourneyActionId },
  disabledReason: string | null,
): ResolvedClinicalJourneyAction & { id: MobileJourneyActionId } {
  if (!disabledReason || disabledReason === action.disabledReasonText) {
    return action;
  }

  return {
    ...action,
    activationDisabledReasonText: action.activationDisabledReasonText,
    blockedReason: "context",
    contextDisabledReasonText: disabledReason,
    disabledReasonText: disabledReason,
    enabled: false,
  };
}

export function PatientJourneyActions({
  context,
  navigation,
  showUnavailable = true,
}: PatientJourneyActionsProps) {
  const hasPermission = usePermissionStore((state) => state.hasPermission);
  const actions = resolveClinicalJourneyActions(context, hasPermission, "mobile", {
    includePermissionDenied: showUnavailable,
  }).filter(supportedAction);
  const actionStates = actions.map((action) => {
    const disabledReason = mobileDisabledReason(action, context, hasPermission);
    return {
      action: applyMobileDisabledReason(action, disabledReason),
      disabledReason,
    };
  });
  const readinessSummary = summarizeClinicalJourneyActions(
    actionStates.map((state) => state.action),
  );

  function handleAction(action: ResolvedClinicalJourneyAction & { id: MobileJourneyActionId }) {
    if (mobileDisabledReason(action, context, hasPermission)) return;

    switch (action.id) {
      case "billing.collect_payment":
        if (context.activeInvoiceId) {
          navigation.navigate("Payment", {
            invoiceId: context.activeInvoiceId,
          });
          return;
        }
        navigation.navigate("Billing", {
          filter: "pending",
          handoff: "payment",
          patientId: context.patientId,
        });
        return;
      case "billing.open_ledger":
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
      case "billing.prepare_discharge_bill":
        navigation.navigate("Billing", {
          filter: "pending",
          handoff: "discharge_bill",
          patientId: context.patientId,
        });
        return;
      case "camp.open_context":
        navigation.navigate("PatientCareContext", {
          handoff: "open_context",
          module: "camp",
          patientId: context.patientId,
        });
        return;
      case "emergency.open_mlc":
        navigation.navigate("PatientCareContext", {
          handoff: "open_mlc",
          module: "emergency",
          patientId: context.patientId,
        });
        return;
      case "emergency.open_visit":
        navigation.navigate("PatientCareContext", {
          handoff: "open_visit",
          module: "emergency",
          patientId: context.patientId,
        });
        return;
      case "ipd.admit":
        navigation.navigate("PatientCareContext", {
          handoff: "admit",
          module: "ipd",
          patientId: context.patientId,
        });
        return;
      case "ipd.open_admission":
        navigation.navigate("PatientCareContext", {
          handoff: "open_admission",
          module: "ipd",
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
        navigation.navigate("Prescription", mobileOrderParams(context));
        return;
      case "orders.lab":
        navigation.navigate("LabOrder", mobileOrderParams(context));
        return;
      case "orders.radiology":
        navigation.navigate("RadiologyOrder", mobileOrderParams(context));
        return;
      case "pharmacy.dispense_order":
        navigation.navigate("PatientPharmacy", {
          handoff: "dispense",
          patientId: context.patientId,
        });
        return;
      case "pharmacy.open_patient_queue":
        navigation.navigate("PatientPharmacy", {
          handoff: "queue",
          patientId: context.patientId,
        });
        return;
    }
  }

  if (actions.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text variant="titleSmall" style={styles.title}>
            Patient Flow
          </Text>
          <Text variant="bodySmall" style={styles.subtitle}>
            Event and permission driven mobile handoffs
          </Text>
        </View>
        <View style={styles.summaryChips}>
          <Chip compact icon="check-circle" mode="outlined">
            {readinessSummary.enabled}/{readinessSummary.total} ready
          </Chip>
          {readinessSummary.blocked > 0 && (
            <Chip compact icon="lock-alert" mode="outlined">
              {readinessSummary.blocked} blocked
            </Chip>
          )}
          {readinessSummary.permissionBlocked > 0 && (
            <Chip compact icon="shield-lock" mode="outlined">
              {readinessSummary.permissionBlocked} permission
            </Chip>
          )}
          {readinessSummary.eventBlocked > 0 && (
            <Chip compact icon="source-branch" mode="outlined">
              {readinessSummary.eventBlocked} awaiting event
            </Chip>
          )}
          {readinessSummary.configurationBlocked > 0 && (
            <Chip compact icon="cog" mode="outlined">
              {readinessSummary.configurationBlocked} config
            </Chip>
          )}
          {readinessSummary.maskingBlocked > 0 && (
            <Chip compact icon="eye-off" mode="outlined">
              {readinessSummary.maskingBlocked} masking
            </Chip>
          )}
          {readinessSummary.regulatoryBlocked > 0 && (
            <Chip compact icon="shield-alert" mode="outlined">
              {readinessSummary.regulatoryBlocked} regulatory
            </Chip>
          )}
        </View>
      </View>
      <View style={styles.actions}>
        {actionStates.map(({ action, disabledReason }) => {
          const blocked = Boolean(disabledReason);
          return (
            <View
              key={action.id}
              style={[styles.actionBlock, blocked && styles.blockedActionBlock]}
            >
              <Button
                mode={action.intent === "primary" ? "contained" : "outlined"}
                icon={actionIcon(action.id)}
                disabled={blocked}
                onPress={() => handleAction(action)}
                compact
              >
                {actionLabel(action)}
              </Button>
              <Text variant="labelSmall" style={styles.reason}>
                {disabledReason
                  ? `${blockedReasonLabel(action.blockedReason) ?? "Blocked"}: ${disabledReason}`
                  : actionActivationText(action)}
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
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },
  title: {
    fontWeight: "700",
  },
  subtitle: {
    opacity: 0.65,
  },
  summaryChips: {
    alignItems: "flex-end",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    justifyContent: "flex-end",
    maxWidth: "62%",
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
  blockedActionBlock: {
    opacity: 0.72,
  },
  reason: {
    opacity: 0.6,
  },
});
