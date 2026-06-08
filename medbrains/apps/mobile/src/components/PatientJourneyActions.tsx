import { usePermissionStore } from "@medbrains/stores";
import type {
  ClinicalJourneyActionId,
  ClinicalJourneyActionSignal,
  ClinicalJourneyBlockedReason,
  ClinicalJourneyContext,
  ClinicalJourneyMessageValues,
  ResolvedClinicalJourneyAction,
} from "@medbrains/types";
import {
  clinicalJourneyActionSignal,
  journeyActionAvailability,
  journeyActionDisabledReason,
  journeyActionShortLabel,
  journeyBlockedReasonLabel,
  resolveClinicalJourneyActions,
  summarizeClinicalJourneyActions,
} from "@medbrains/types";
import { WorkflowSignalMarker, workflowSignalColors } from "@medbrains/ui-mobile";
import { StyleSheet, View } from "react-native";
import { Button, Chip, Text } from "react-native-paper";
import {
  mobileCampCareContextParams,
  mobileIpdCareContextParams,
} from "../navigation/careContextParams";
import {
  MOBILE_PATIENT_JOURNEY_BLOCKERS,
  MOBILE_PATIENT_JOURNEY_TEXT,
  mobilePatientJourneyText,
  mobilePatientJourneyTranslator,
} from "./patientJourneyText";

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

interface MobileActionBlocker {
  key: string;
  message: string;
  values?: ClinicalJourneyMessageValues;
  reason: ClinicalJourneyBlockedReason;
}

type MobileActionReadinessSignal = ClinicalJourneyActionSignal;

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

function supportedAction(
  action: ResolvedClinicalJourneyAction,
): action is ResolvedClinicalJourneyAction & { id: MobileJourneyActionId } {
  return SUPPORTED_MOBILE_ACTIONS.has(action.id);
}

function ActionReadinessShape({
  label,
  signal,
}: {
  label: string;
  signal: MobileActionReadinessSignal;
}) {
  return (
    <WorkflowSignalMarker
      accessibilityLabel={label}
      emphasis={signal.emphasis}
      pillExtension={14}
      shape={signal.shape}
      size={signal.emphasis === "high" ? 16 : 13}
      tone={signal.tone}
    />
  );
}

function mobileActionBlocker(
  action: ResolvedClinicalJourneyAction & { id: MobileJourneyActionId },
  context: ClinicalJourneyContext,
): MobileActionBlocker | null {
  if (action.disabledReasonText) return null;

  const hasMobileOrderContext =
    (context.activeOrderContext === "opd" && Boolean(context.activeEncounterId)) ||
    (context.activeOrderContext === "ipd" &&
      Boolean(context.activeAdmissionId) &&
      Boolean(context.activeEncounterId));

  if (
    action.id === "opd.open_visit" &&
    (!context.activeEncounterId || context.activeOrderContext !== "opd")
  ) {
    return {
      key: MOBILE_PATIENT_JOURNEY_BLOCKERS.openOpdEncounterBeforeMobileConsultation,
      message: mobilePatientJourneyText(
        MOBILE_PATIENT_JOURNEY_BLOCKERS.openOpdEncounterBeforeMobileConsultation,
      ),
      reason: "context",
    };
  }
  if (
    (action.id === "orders.medication" ||
      action.id === "orders.lab" ||
      action.id === "orders.radiology") &&
    !hasMobileOrderContext
  ) {
    return context.activeOrderContext === "ipd"
      ? {
          key: MOBILE_PATIENT_JOURNEY_BLOCKERS.openActiveIpdEncounterBeforeMobileInpatientOrders,
          message: mobilePatientJourneyText(
            MOBILE_PATIENT_JOURNEY_BLOCKERS.openActiveIpdEncounterBeforeMobileInpatientOrders,
          ),
          reason: "context",
        }
      : {
          key: MOBILE_PATIENT_JOURNEY_BLOCKERS.openOpdEncounterBeforeMobileOrders,
          message: mobilePatientJourneyText(
            MOBILE_PATIENT_JOURNEY_BLOCKERS.openOpdEncounterBeforeMobileOrders,
          ),
          reason: "context",
        };
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

function mobileBillingParams(
  context: ClinicalJourneyContext,
  params: {
    filter: "all" | "paid" | "pending";
    handoff?: "discharge_bill" | "payment";
  },
) {
  return {
    admissionId: context.activeAdmissionId ?? undefined,
    encounterId: context.activeAdmissionId ? undefined : (context.activeEncounterId ?? undefined),
    filter: params.filter,
    handoff: params.handoff,
    patientId: context.patientId,
  };
}

function applyMobileDisabledReason(
  action: ResolvedClinicalJourneyAction & { id: MobileJourneyActionId },
  blocker: MobileActionBlocker | null,
): ResolvedClinicalJourneyAction & { id: MobileJourneyActionId } {
  if (!blocker) {
    return action;
  }

  return {
    ...action,
    blockedReason: blocker.reason,
    contextDisabledReasonKey: blocker.key,
    contextDisabledReasonText: blocker.message,
    contextDisabledReasonValues: blocker.values ?? null,
    disabledReasonKey: blocker.key,
    disabledReasonText: blocker.message,
    disabledReasonValues: blocker.values ?? null,
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
  const actionStates = actions.map((action) =>
    applyMobileDisabledReason(action, mobileActionBlocker(action, context)),
  );
  const readinessSummary = summarizeClinicalJourneyActions(actionStates);

  function handleAction(action: ResolvedClinicalJourneyAction & { id: MobileJourneyActionId }) {
    if (!action.enabled) return;

    switch (action.id) {
      case "billing.collect_payment":
        if (context.activeInvoiceId) {
          navigation.navigate("Payment", {
            invoiceId: context.activeInvoiceId,
          });
          return;
        }
        navigation.navigate(
          "Billing",
          mobileBillingParams(context, { filter: "pending", handoff: "payment" }),
        );
        return;
      case "billing.open_ledger":
        if (context.activeInvoiceId) {
          navigation.navigate("BillDetail", {
            invoiceId: context.activeInvoiceId,
          });
          return;
        }
        navigation.navigate("Billing", mobileBillingParams(context, { filter: "all" }));
        return;
      case "billing.prepare_discharge_bill":
        navigation.navigate(
          "Billing",
          mobileBillingParams(context, { filter: "pending", handoff: "discharge_bill" }),
        );
        return;
      case "camp.open_context":
        navigation.navigate("PatientCareContext", mobileCampCareContextParams(context));
        return;
      case "emergency.open_mlc":
        navigation.navigate("PatientCareContext", {
          erVisitId: context.activeEmergencyVisitId ?? undefined,
          handoff: "open_mlc",
          module: "emergency",
          patientId: context.patientId,
        });
        return;
      case "emergency.open_visit":
        navigation.navigate("PatientCareContext", {
          erVisitId: context.activeEmergencyVisitId ?? undefined,
          handoff: "open_visit",
          module: "emergency",
          patientId: context.patientId,
        });
        return;
      case "ipd.admit":
      case "ipd.open_admission":
        navigation.navigate("PatientCareContext", mobileIpdCareContextParams(context));
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
          pharmacyOrderId: context.activePharmacyOrderId ?? undefined,
          pharmacyRxQueueId: context.activePharmacyRxQueueId ?? undefined,
        });
        return;
      case "pharmacy.open_patient_queue":
        navigation.navigate("PatientPharmacy", {
          handoff: "queue",
          patientId: context.patientId,
          pharmacyOrderId: context.activePharmacyOrderId ?? undefined,
          pharmacyRxQueueId: context.activePharmacyRxQueueId ?? undefined,
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
            {mobilePatientJourneyText(MOBILE_PATIENT_JOURNEY_TEXT.actionPanel.title)}
          </Text>
          <Text variant="bodySmall" style={styles.subtitle}>
            {mobilePatientJourneyText(MOBILE_PATIENT_JOURNEY_TEXT.actionPanel.subtitle)}
          </Text>
        </View>
        <View style={styles.summaryChips}>
          <Chip compact icon="check-circle" mode="outlined">
            {mobilePatientJourneyText(MOBILE_PATIENT_JOURNEY_TEXT.summary.readyCount, {
              enabled: readinessSummary.enabled,
              total: readinessSummary.total,
            })}
          </Chip>
          {readinessSummary.blocked > 0 && (
            <Chip compact icon="lock-alert" mode="outlined">
              {mobilePatientJourneyText(MOBILE_PATIENT_JOURNEY_TEXT.summary.blockedCount, {
                count: readinessSummary.blocked,
              })}
            </Chip>
          )}
          {readinessSummary.permissionBlocked > 0 && (
            <Chip compact icon="shield-lock" mode="outlined">
              {mobilePatientJourneyText(MOBILE_PATIENT_JOURNEY_TEXT.summary.permissionCount, {
                count: readinessSummary.permissionBlocked,
              })}
            </Chip>
          )}
          {readinessSummary.eventBlocked > 0 && (
            <Chip compact icon="source-branch" mode="outlined">
              {mobilePatientJourneyText(MOBILE_PATIENT_JOURNEY_TEXT.summary.awaitingEventCount, {
                count: readinessSummary.eventBlocked,
              })}
            </Chip>
          )}
          {readinessSummary.configurationBlocked > 0 && (
            <Chip compact icon="cog" mode="outlined">
              {mobilePatientJourneyText(MOBILE_PATIENT_JOURNEY_TEXT.summary.configCount, {
                count: readinessSummary.configurationBlocked,
              })}
            </Chip>
          )}
          {readinessSummary.maskingBlocked > 0 && (
            <Chip compact icon="eye-off" mode="outlined">
              {mobilePatientJourneyText(MOBILE_PATIENT_JOURNEY_TEXT.summary.maskingCount, {
                count: readinessSummary.maskingBlocked,
              })}
            </Chip>
          )}
          {readinessSummary.regulatoryBlocked > 0 && (
            <Chip compact icon="shield-alert" mode="outlined">
              {mobilePatientJourneyText(MOBILE_PATIENT_JOURNEY_TEXT.summary.regulatoryCount, {
                count: readinessSummary.regulatoryBlocked,
              })}
            </Chip>
          )}
        </View>
      </View>
      <View style={styles.actions}>
        {actionStates.map((action) => {
          const blocked = !action.enabled;
          const signal = clinicalJourneyActionSignal(action);
          const signalColors = workflowSignalColors(signal.tone);
          const reason = blocked
            ? journeyActionDisabledReason(mobilePatientJourneyTranslator, action)
            : journeyActionAvailability(mobilePatientJourneyTranslator, action);
          const blockedLabel = blocked
            ? journeyBlockedReasonLabel(mobilePatientJourneyTranslator, action.blockedReason)
            : null;
          const readinessLabel =
            blockedLabel ?? mobilePatientJourneyText(MOBILE_PATIENT_JOURNEY_TEXT.status.ready);

          return (
            <View
              key={action.id}
              style={[
                styles.actionBlock,
                { borderLeftColor: signalColors.border },
                blocked && styles.blockedActionBlock,
              ]}
            >
              <View style={styles.actionStateRow}>
                <ActionReadinessShape label={readinessLabel} signal={signal} />
                <Text
                  variant="labelSmall"
                  style={[styles.actionStateText, { color: signalColors.text }]}
                >
                  {readinessLabel}
                </Text>
              </View>
              <Button
                mode={action.intent === "primary" ? "contained" : "outlined"}
                icon={actionIcon(action.id)}
                disabled={blocked}
                onPress={() => handleAction(action)}
                compact
              >
                {journeyActionShortLabel(mobilePatientJourneyTranslator, action.id)}
              </Button>
              <Text variant="labelSmall" style={styles.reason}>
                {reason}
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
    borderLeftWidth: 3,
    gap: 5,
    paddingLeft: 8,
  },
  blockedActionBlock: {
    opacity: 0.72,
  },
  actionStateRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    minHeight: 18,
  },
  actionStateText: {
    fontWeight: "700",
  },
  reason: {
    opacity: 0.6,
  },
});
