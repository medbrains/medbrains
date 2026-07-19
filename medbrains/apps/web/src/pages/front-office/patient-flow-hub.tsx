// FRONT-OFFICE PatientFlowHub — split from front-office.tsx (pure move).

import { Card, Group, SimpleGrid, Stack, Text, Tooltip } from "@mantine/core";
import type {
  ClinicalEventName,
  ClinicalJourneyActionDefinition,
  ClinicalJourneyActionId,
} from "@medbrains/types";
import { CORE_PATIENT_JOURNEY_ACTIONS, P, TOKEN_BOARD_SURFACE_LIST } from "@medbrains/types";
import {
  IconAmbulance,
  IconArrowRight,
  IconBed,
  IconBuildingStore,
  IconDeviceTv,
  IconDoorEnter,
  IconMapPin,
  IconPackage,
  IconPill,
  IconReceipt,
  IconStethoscope,
  IconUserPlus,
  IconUsers,
} from "@tabler/icons-react";
import type { ReactNode } from "react";
import type { useNavigate } from "react-router";
import { Badge, Button } from "@/components/ui";

interface PatientFlowHubProps {
  navigate: ReturnType<typeof useNavigate>;
  canRegisterPatient: boolean;
  canCreateOpdVisit: boolean;
  canViewOpdQueue: boolean;
  canViewAnyTokenBoard: boolean;
  canCreateEmergencyVisit: boolean;
  canViewEmergency: boolean;
  canViewCamp: boolean;
  canCreateCampRegistration: boolean;
  canViewBilling: boolean;
  canCreateBilling: boolean;
  canViewPharmacy: boolean;
  canViewIndent: boolean;
  canViewProcurementStores: boolean;
  canViewAssets: boolean;
  canViewIpd: boolean;
  canCreateIpdAdmission: boolean;
}

interface PatientFlowAction {
  title: string;
  module: string;
  description: string;
  path: string;
  enabled: boolean;
  icon: ReactNode;
  journeyActionId?: ClinicalJourneyActionId;
  activationEvents?: readonly ClinicalEventName[];
  emittedEvent?: ClinicalEventName;
  requiredPermissions?: readonly string[];
  standardRefs?: readonly string[];
}

function eventLabel(eventName: string) {
  return eventName.replace(/\./g, " ");
}

function patientFlowActionMetadata(action: PatientFlowAction) {
  const journeyAction = patientFlowJourneyAction(action.journeyActionId);

  return {
    activationEvents: action.activationEvents ?? journeyAction?.activatesAfter ?? [],
    description: journeyAction?.description ?? action.description,
    emittedEvent: action.emittedEvent ?? journeyAction?.emitsEvent ?? null,
    requiredPermissions: action.requiredPermissions ?? journeyAction?.requiredPermissions ?? [],
    standardRefs: action.standardRefs ?? journeyAction?.standardRefs ?? [],
  };
}

function patientFlowJourneyAction(
  actionId: ClinicalJourneyActionId | undefined,
): ClinicalJourneyActionDefinition | null {
  if (!actionId) return null;
  return CORE_PATIENT_JOURNEY_ACTIONS.find((action) => action.id === actionId) ?? null;
}

export function PatientFlowHub({
  navigate,
  canRegisterPatient,
  canCreateOpdVisit,
  canViewOpdQueue,
  canViewAnyTokenBoard,
  canCreateEmergencyVisit,
  canViewEmergency,
  canViewCamp,
  canCreateCampRegistration,
  canViewBilling,
  canCreateBilling,
  canViewPharmacy,
  canViewIndent,
  canViewProcurementStores,
  canViewAssets,
  canViewIpd,
  canCreateIpdAdmission,
}: PatientFlowHubProps) {
  const actions: PatientFlowAction[] = [
    {
      title: "Register Patient",
      module: "Registration",
      description: "Create the patient record before OPD, ER, IPD or camp service.",
      path: "/patients/register",
      enabled: canRegisterPatient,
      icon: <IconUserPlus size={20} />,
      emittedEvent: "patient.created",
      requiredPermissions: [P.PATIENTS.CREATE],
      standardRefs: ["NABH AAC", "IPSG patient identification"],
    },
    {
      title: "Start OPD Visit",
      module: "OPD",
      description: "Create the visit, assign doctor and send the patient to the OPD queue.",
      path: "/opd/new",
      enabled: canCreateOpdVisit,
      icon: <IconStethoscope size={20} />,
      journeyActionId: "opd.open_visit",
    },
    {
      title: "OPD Queue",
      module: "OPD",
      description: "Track waiting patients, tokens and department queue load.",
      path: "/opd",
      enabled: canViewOpdQueue,
      icon: <IconUsers size={20} />,
    },
    {
      title: "Token Boards",
      module: "Displays",
      description: `Monitor public token feeds for ${TOKEN_BOARD_SURFACE_LIST.map(
        (surface) => surface.title,
      ).join(", ")}.`,
      path: "/front-office#token-boards",
      enabled: canViewAnyTokenBoard,
      icon: <IconDeviceTv size={20} />,
      requiredPermissions: TOKEN_BOARD_SURFACE_LIST.flatMap((surface) => [
        ...surface.requiredAnyPermissions,
      ]),
      standardRefs: TOKEN_BOARD_SURFACE_LIST.flatMap((surface) => [...surface.standardRefs]),
    },
    {
      title: "Emergency Desk",
      module: "ER",
      description: "Open ER visits, triage, MLC and critical flow from reception.",
      path: "/emergency",
      enabled: canCreateEmergencyVisit || canViewEmergency,
      icon: <IconAmbulance size={20} />,
      journeyActionId: "emergency.open_visit",
    },
    {
      title: "Camp Desk",
      module: "Camp",
      description: "Handle outreach registrations, screenings, samples and camp billing.",
      path: "/camp",
      enabled: canViewCamp || canCreateCampRegistration,
      icon: <IconMapPin size={20} />,
      journeyActionId: "camp.open_context",
    },
    {
      title: "Billing Counter",
      module: "Billing",
      description: "Create invoices, collect payments, advances and counter receipts.",
      path: "/billing",
      enabled: canViewBilling || canCreateBilling,
      icon: <IconReceipt size={20} />,
      journeyActionId: "billing.open_ledger",
    },
    {
      title: "Pharmacy Queue",
      module: "Pharmacy",
      description: "Send prescription and dispensing questions to the pharmacy counter.",
      path: "/pharmacy",
      enabled: canViewPharmacy,
      icon: <IconPill size={20} />,
      journeyActionId: "pharmacy.open_patient_queue",
    },
    {
      title: "IPD Admission",
      module: "IPD",
      description: "Route admitted patients to bed, ward and inpatient workflows.",
      path: "/ipd",
      enabled: canViewIpd || canCreateIpdAdmission,
      icon: <IconBed size={20} />,
      journeyActionId: "ipd.admit",
    },
    {
      title: "Store Indents",
      module: "Stores",
      description: "Check requisitions, stock movement, borrow and return workflows.",
      path: "/indent",
      enabled: canViewIndent,
      icon: <IconPackage size={20} />,
    },
    {
      title: "Procurement",
      module: "Stores",
      description: "Open vendors, POs, GRN and multi-store procurement operations.",
      path: "/procurement",
      enabled: canViewProcurementStores,
      icon: <IconBuildingStore size={20} />,
    },
    {
      title: "Assets",
      module: "Assets",
      description: "Reserve, issue, return and locate patient-facing equipment.",
      path: "/assets",
      enabled: canViewAssets,
      icon: <IconPackage size={20} />,
    },
  ];

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-start">
        <div>
          <Text fw={600}>Reception workflow entry points</Text>
          <Text size="sm" c="dimmed">
            Front Office coordinates patient movement; the source records stay in their owning
            modules.
          </Text>
        </div>
        <Badge size="sm" tone="primary" leftSection={<IconDoorEnter size={12} />}>
          Intake
        </Badge>
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
        {actions.map((action) => {
          const metadata = patientFlowActionMetadata(action);
          const permissionLabel =
            metadata.requiredPermissions.length > 1
              ? `${metadata.requiredPermissions[0]} +${metadata.requiredPermissions.length - 1}`
              : metadata.requiredPermissions[0];

          return (
            <Card key={action.title} withBorder padding="md">
              <Stack gap="sm" h="100%">
                <Group justify="space-between" align="flex-start" wrap="nowrap">
                  <Group gap="sm" wrap="nowrap">
                    <Badge
                      size="lg"
                      tone={action.enabled ? "primary" : "neutral"}
                      leftSection={action.icon}
                    >
                      {action.module}
                    </Badge>
                  </Group>
                  {!action.enabled && (
                    <Badge size="xs" tone="neutral">
                      No access
                    </Badge>
                  )}
                </Group>
                <div>
                  <Text fw={600}>{action.title}</Text>
                  <Text size="sm" c="dimmed">
                    {metadata.description}
                  </Text>
                </div>
                {(metadata.activationEvents.length > 0 || metadata.emittedEvent) && (
                  <Group gap={4}>
                    {metadata.activationEvents.slice(0, 2).map((eventName) => (
                      <Badge key={eventName} size="xs" tone="info">
                        after {eventLabel(eventName)}
                      </Badge>
                    ))}
                    {metadata.activationEvents.length > 2 && (
                      <Badge size="xs" tone="info">
                        +{metadata.activationEvents.length - 2}
                      </Badge>
                    )}
                    {metadata.emittedEvent && (
                      <Badge size="xs" tone="success">
                        emits {eventLabel(metadata.emittedEvent)}
                      </Badge>
                    )}
                  </Group>
                )}
                {permissionLabel && (
                  <Tooltip label={metadata.requiredPermissions.join(" / ")}>
                    <Text size="xs" c="dimmed">
                      Permission: {permissionLabel}
                    </Text>
                  </Tooltip>
                )}
                {metadata.standardRefs.length > 0 && (
                  <Text size="xs" c="dimmed">
                    Standards: {metadata.standardRefs.slice(0, 2).join(" · ")}
                  </Text>
                )}
                <Button
                  tone={action.enabled ? "secondary" : "ghost"}
                  mt="auto"
                  rightSection={<IconArrowRight size={16} />}
                  disabled={!action.enabled}
                  onClick={() => navigate(action.path)}
                >
                  Open
                </Button>
              </Stack>
            </Card>
          );
        })}
      </SimpleGrid>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Tab 2 — Queue Dashboard
// ══════════════════════════════════════════════════════════
