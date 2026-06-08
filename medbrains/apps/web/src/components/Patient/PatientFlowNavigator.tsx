import { Badge, Button, Group, Stack, Text, Tooltip } from "@mantine/core";
import { usePermissionStore } from "@medbrains/stores";
import type {
  ClinicalEventName,
  ClinicalOrderContext,
  PatientFlowModule,
  PatientFlowReadinessItem,
} from "@medbrains/types";
import { buildPatientFlowReadiness, patientFlowJourneyContext } from "@medbrains/types";
import {
  IconBed,
  IconBuildingStore,
  IconCash,
  IconFileInvoice,
  IconFirstAidKit,
  IconPill,
  IconStethoscope,
  IconUser,
} from "@tabler/icons-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { useClinicalEventStore } from "@/components/clinical-event-store";
import styles from "./patient-flow-navigator.module.scss";
import { clinicalEventMatchesJourney, mergeJourneyEventNames } from "./patient-journey-events";
import {
  clinicalEventLabel,
  journeyBlockedReasonLabel,
  patientFlowItemDescription,
  patientFlowItemDisabledReason,
  patientFlowItemLabel,
} from "./patient-journey-i18n";

export type { PatientFlowModule } from "@medbrains/types";

interface PatientFlowNavigatorProps {
  patientId: string | null | undefined;
  active: PatientFlowModule;
  activeEncounterId?: string | null;
  activeAdmissionId?: string | null;
  activeAdmissionStatus?: string | null;
  activeBedId?: string | null;
  activeEmergencyVisitId?: string | null;
  activeCampId?: string | null;
  activeCampRegistrationId?: string | null;
  activeInvoiceId?: string | null;
  activePharmacyOrderId?: string | null;
  activePharmacyRxQueueId?: string | null;
  activeOrderContext?: ClinicalOrderContext | null;
  completedEvents?: readonly ClinicalEventName[];
  isDeceased?: boolean;
  compact?: boolean;
}

interface FlowVisual {
  color: string;
  icon: ReactNode;
}

const FLOW_VISUALS: Record<PatientFlowModule, FlowVisual> = {
  patient: { color: "primary", icon: <IconUser size={14} /> },
  opd: { color: "teal", icon: <IconStethoscope size={14} /> },
  ipd: { color: "indigo", icon: <IconBed size={14} /> },
  emergency: { color: "red", icon: <IconFirstAidKit size={14} /> },
  camp: { color: "green", icon: <IconBuildingStore size={14} /> },
  pharmacy: { color: "lime", icon: <IconPill size={14} /> },
  billing: { color: "orange", icon: <IconFileInvoice size={14} /> },
};

function FlowTooltip({ item }: { item: PatientFlowReadinessItem }) {
  const { t } = useTranslation("clinical");
  const blockedLabel = journeyBlockedReasonLabel(t, item.blockedReason);

  return (
    <Stack gap={5}>
      <Text size="xs" fw={700}>
        {item.enabled
          ? patientFlowItemDescription(t, item)
          : patientFlowItemDisabledReason(t, item)}
      </Text>
      {blockedLabel && (
        <Badge size="xs" color="orange" variant="light">
          {t("patientJourney.tooltip.blockedBy", { reason: blockedLabel })}
        </Badge>
      )}
      <Group gap={4}>
        {item.activationEvents.length > 0 ? (
          item.activationEvents.map((eventName) => (
            <Badge key={eventName} size="xs" color="blue" variant="light">
              {t("patientJourney.badges.afterEvent", {
                event: clinicalEventLabel(t, eventName),
              })}
            </Badge>
          ))
        ) : (
          <Badge size="xs" color="gray" variant="light">
            {t("patientJourney.badges.always")}
          </Badge>
        )}
      </Group>
      {item.emittedEvent && (
        <Badge size="xs" color="green" variant="light">
          {t("patientJourney.badges.emitsEvent", {
            event: clinicalEventLabel(t, item.emittedEvent),
          })}
        </Badge>
      )}
      {item.requiredPermissions.length > 0 && (
        <Text size="xs" c="dimmed">
          {t("patientJourney.tooltip.permissions", {
            permissions: item.requiredPermissions.join(" / "),
          })}
        </Text>
      )}
    </Stack>
  );
}

export function PatientFlowNavigator({
  patientId,
  active,
  activeEncounterId,
  activeAdmissionId,
  activeAdmissionStatus,
  activeBedId,
  activeEmergencyVisitId,
  activeCampId,
  activeCampRegistrationId,
  activeInvoiceId,
  activePharmacyOrderId,
  activePharmacyRxQueueId,
  activeOrderContext,
  completedEvents,
  isDeceased = false,
  compact = false,
}: PatientFlowNavigatorProps) {
  const navigate = useNavigate();
  const { t } = useTranslation("clinical");
  const hasPermission = usePermissionStore((state) => state.hasPermission);
  const recentEvents = useClinicalEventStore((state) => state.recentEvents);

  if (!patientId) return null;

  const baseContext = patientFlowJourneyContext({
    patientId,
    isDeceased,
    activeEncounterId,
    activeAdmissionId,
    activeBedId,
    activeEmergencyVisitId,
    activeCampId,
    activeCampRegistrationId,
    activeInvoiceId,
    activePharmacyOrderId,
    activePharmacyRxQueueId,
    activeAdmissionStatus,
    activeOrderContext,
    completedEvents,
  });
  const context = {
    ...baseContext,
    completedEvents: mergeJourneyEventNames(baseContext, recentEvents),
  };
  const recentPatientEvent = recentEvents.find((event) =>
    clinicalEventMatchesJourney(event, context),
  );
  const { items, summary } = buildPatientFlowReadiness(context, hasPermission);

  return (
    <div className={styles.wrapper} data-compact={compact || undefined}>
      <Group justify="space-between" gap="xs" align="center" className={styles.header}>
        <Group gap={6}>
          <IconCash size={14} />
          <Text size="xs" fw={700}>
            {t("patientJourney.flow.title")}
          </Text>
        </Group>
        <Group gap={4}>
          <Badge size="xs" color={summary.blocked > 0 ? "orange" : "green"} variant="light">
            {t("patientJourney.flow.readySummary", {
              enabled: summary.enabled,
              total: summary.total,
            })}
          </Badge>
          <Badge size="xs" color={recentPatientEvent ? "green" : "blue"} variant="light">
            {recentPatientEvent
              ? t("patientJourney.flow.lastEvent", {
                  event: recentPatientEvent.eventName
                    ? clinicalEventLabel(t, recentPatientEvent.eventName)
                    : t("patientJourney.events.unknown", {
                        trigger: recentPatientEvent.rawTrigger,
                      }),
                })
              : t("patientJourney.flow.eventActivated")}
          </Badge>
        </Group>
      </Group>
      <Group gap="xs" wrap="wrap">
        {items.map((item) => {
          const isActive = item.id === active;
          const visual = FLOW_VISUALS[item.id];
          const button = (
            <Button
              key={item.id}
              size="xs"
              radius="xl"
              color={visual.color}
              variant={isActive ? "filled" : "light"}
              leftSection={visual.icon}
              disabled={!item.enabled}
              onClick={() => navigate(item.href)}
            >
              {patientFlowItemLabel(t, item)}
            </Button>
          );
          return (
            <Tooltip key={item.id} label={<FlowTooltip item={item} />} multiline w={280}>
              <span>{button}</span>
            </Tooltip>
          );
        })}
      </Group>
    </div>
  );
}
