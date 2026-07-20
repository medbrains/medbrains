import { Card, Group, SimpleGrid, Stack, Tabs, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { useState } from "react";
import { useSearchParams } from "react-router";
import { PageHeader } from "@/components";
import { HandoffPanel } from "@/components/crdt/HandoffPanel";
import { NursingNotesPanel } from "@/components/crdt/NursingNotesPanel";
import { PatientContextBanner } from "@/components/Patient/PatientContextBanner";
import { Alert, Badge } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { CodeBlueTab } from "./nurse-activities/code-blue-tab";
import { EquipmentTab } from "./nurse-activities/equipment-tab";
import { HandoffWorkflowPanel } from "./nurse-activities/handoff-workflow-panel";
import { IoTab } from "./nurse-activities/io-tab";
import { MarTab } from "./nurse-activities/mar-tab";
import { NurseRxTab } from "./nurse-activities/nurse-rx-tab";
import { SafetyTab } from "./nurse-activities/safety-tab";
import { VitalsTab } from "./nurse-activities/vitals-tab";

type NurseTabKey =
  | "mar"
  | "vitals"
  | "io"
  | "safety"
  | "code-blue"
  | "handoff"
  | "shift-notes"
  | "equipment"
  | "prescriptions";

const NURSE_PAGE_PERMISSIONS = [
  P.NURSE.DASHBOARD_VIEW,
  P.NURSE.MAR_VIEW,
  P.NURSE.VITALS_VIEW,
  P.NURSE.VITALS_RECORD,
  P.NURSE.INTAKE_OUTPUT_VIEW,
  P.NURSE.INTAKE_OUTPUT_RECORD,
  P.NURSE.PAIN_VIEW,
  P.NURSE.PAIN_RECORD,
  P.NURSE.FALL_RISK_VIEW,
  P.NURSE.FALL_RISK_RECORD,
  P.NURSE.WOUND_VIEW,
  P.NURSE.WOUND_RECORD,
  P.NURSE.RESTRAINT_VIEW,
  P.NURSE.RESTRAINT_RECORD,
  P.NURSE.CODE_BLUE_VIEW,
  P.NURSE.CODE_BLUE_RECORD,
  P.NURSE.HANDOFF_VIEW,
  P.NURSE.HANDOFF_RECORD,
  P.NURSE.EQUIPMENT_VIEW,
  P.NURSE.EQUIPMENT_RECORD,
] as const;

function nurseTabFromSearch(value: string | null): NurseTabKey | null {
  if (
    value === "mar" ||
    value === "vitals" ||
    value === "io" ||
    value === "safety" ||
    value === "code-blue" ||
    value === "handoff" ||
    value === "shift-notes" ||
    value === "equipment" ||
    value === "prescriptions"
  ) {
    return value;
  }

  return null;
}

export function NurseActivitiesPage() {
  useRequirePermission(NURSE_PAGE_PERMISSIONS);
  const [searchParams] = useSearchParams();
  const contextPatientId = searchParams.get("patient_id") ?? "";
  const contextAdmissionId = searchParams.get("admission_id") ?? "";
  const contextEncounterId = searchParams.get("encounter_id") ?? "";
  const contextWardId = searchParams.get("ward_id") ?? "";
  const contextBedId = searchParams.get("bed_id") ?? "";
  const contextChargeable = searchParams.get("chargeable") ?? "";
  const contextChargeContext = searchParams.get("charge_context") ?? "";
  const requestedTab = nurseTabFromSearch(searchParams.get("tab"));
  const canViewMar = useHasPermission(P.NURSE.MAR_VIEW);
  const canViewVitals = useHasPermission(P.NURSE.VITALS_VIEW);
  const canRecordVitals = useHasPermission(P.NURSE.VITALS_RECORD);
  const canViewIo = useHasPermission(P.NURSE.INTAKE_OUTPUT_VIEW);
  const canRecordIo = useHasPermission(P.NURSE.INTAKE_OUTPUT_RECORD);
  const canViewPain = useHasPermission(P.NURSE.PAIN_VIEW);
  const canRecordPain = useHasPermission(P.NURSE.PAIN_RECORD);
  const canViewFallRisk = useHasPermission(P.NURSE.FALL_RISK_VIEW);
  const canRecordFallRisk = useHasPermission(P.NURSE.FALL_RISK_RECORD);
  const canViewWound = useHasPermission(P.NURSE.WOUND_VIEW);
  const canRecordWound = useHasPermission(P.NURSE.WOUND_RECORD);
  const canViewCodeBlue = useHasPermission(P.NURSE.CODE_BLUE_VIEW);
  const canRecordCodeBlue = useHasPermission(P.NURSE.CODE_BLUE_RECORD);
  const canViewHandoff = useHasPermission(P.NURSE.HANDOFF_VIEW);
  const canRecordHandoff = useHasPermission(P.NURSE.HANDOFF_RECORD);
  const canViewEquipment = useHasPermission(P.NURSE.EQUIPMENT_VIEW);
  const canRecordEquipment = useHasPermission(P.NURSE.EQUIPMENT_RECORD);
  const canDraftRx = useHasPermission(P.NURSE.PRESCRIPTIONS_DRAFT);
  const canOpenVitals = canViewVitals || canRecordVitals;
  const canOpenIo = canViewIo || canRecordIo;
  const canOpenSafety =
    canViewPain ||
    canRecordPain ||
    canViewFallRisk ||
    canRecordFallRisk ||
    canViewWound ||
    canRecordWound;
  const canOpenCodeBlue = canViewCodeBlue || canRecordCodeBlue;
  const canOpenHandoff = canViewHandoff || canRecordHandoff;
  const canOpenEquipment = canViewEquipment || canRecordEquipment;
  const availableTabs = [
    { value: "mar" as const, label: "MAR", visible: canViewMar },
    { value: "vitals" as const, label: "Vitals", visible: canOpenVitals },
    { value: "io" as const, label: "Intake/Output", visible: canOpenIo },
    { value: "safety" as const, label: "Safety", visible: canOpenSafety },
    { value: "code-blue" as const, label: "Code Blue", visible: canOpenCodeBlue },
    { value: "handoff" as const, label: "Handoff", visible: canOpenHandoff },
    { value: "shift-notes" as const, label: "Shift Notes", visible: canViewHandoff },
    { value: "equipment" as const, label: "Equipment", visible: canOpenEquipment },
    {
      value: "prescriptions" as const,
      label: "Prescriptions",
      visible: canDraftRx && Boolean(contextEncounterId),
    },
  ].filter((item) => item.visible);
  const fallbackTab = availableTabs[0]?.value ?? "mar";
  const initialTab =
    requestedTab && availableTabs.some((item) => item.value === requestedTab)
      ? requestedTab
      : fallbackTab;
  const [selectedTab, setSelectedTab] = useState<NurseTabKey>(initialTab);
  const tab = availableTabs.some((item) => item.value === selectedTab) ? selectedTab : fallbackTab;

  return (
    <div>
      <PageHeader
        title="Nurse Activities"
        subtitle="Medication rounds, vitals, I/O, safety assessments, code blue and handoffs"
      />
      {contextPatientId && <PatientContextBanner patientId={contextPatientId} hideLoadingState />}
      <NurseContextStrip
        admissionId={contextAdmissionId}
        encounterId={contextEncounterId}
        patientId={contextPatientId}
        wardId={contextWardId}
        bedId={contextBedId}
        chargeable={contextChargeable}
        chargeContext={contextChargeContext}
      />
      {availableTabs.length === 0 ? (
        <Text c="dimmed" size="sm">
          No nursing work areas are available for your current role.
        </Text>
      ) : (
        <Tabs
          value={tab}
          onChange={(value) => {
            const nextTab = nurseTabFromSearch(value);
            if (nextTab) {
              setSelectedTab(nextTab);
            }
          }}
          variant="outline"
          keepMounted={false}
        >
          <Tabs.List>
            {availableTabs.map((item) => (
              <Tabs.Tab key={item.value} value={item.value}>
                {item.label}
              </Tabs.Tab>
            ))}
          </Tabs.List>
          {canViewMar && (
            <Tabs.Panel value="mar" pt="md">
              <MarTab patientId={contextPatientId} />
            </Tabs.Panel>
          )}
          {canOpenVitals && (
            <Tabs.Panel value="vitals" pt="md">
              <VitalsTab initialEncounterId={contextEncounterId} patientId={contextPatientId} />
            </Tabs.Panel>
          )}
          {canOpenIo && (
            <Tabs.Panel value="io" pt="md">
              <IoTab initialEncounterId={contextEncounterId} patientId={contextPatientId} />
            </Tabs.Panel>
          )}
          {canOpenSafety && (
            <Tabs.Panel value="safety" pt="md">
              <SafetyTab initialEncounterId={contextEncounterId} patientId={contextPatientId} />
            </Tabs.Panel>
          )}
          {canOpenCodeBlue && (
            <Tabs.Panel value="code-blue" pt="md">
              <CodeBlueTab
                patientId={contextPatientId}
                encounterId={contextEncounterId}
                wardId={contextWardId}
                bedId={contextBedId}
              />
            </Tabs.Panel>
          )}
          {canOpenHandoff && (
            <Tabs.Panel value="handoff" pt="md">
              <Stack>
                <HandoffWorkflowPanel
                  initialEncounterId={contextEncounterId}
                  patientId={contextPatientId}
                />
                {canViewHandoff ? (
                  <Card withBorder padding="md">
                    <Stack gap="sm">
                      <Group justify="space-between">
                        <Text fw={700}>Shift Collaboration Notes</Text>
                        <Badge tone="neutral">Daily shift board</Badge>
                      </Group>
                      <HandoffPanel shiftId={dailyShiftId()} canAppend={canRecordHandoff} />
                    </Stack>
                  </Card>
                ) : (
                  <Alert tone="info">
                    You can sign patient handoffs, but the daily shift board requires handoff view
                    permission.
                  </Alert>
                )}
              </Stack>
            </Tabs.Panel>
          )}
          {canViewHandoff && (
            <Tabs.Panel value="shift-notes" pt="md">
              <NursingNotesPanel shiftId={dailyShiftId()} canEdit={canRecordHandoff} />
            </Tabs.Panel>
          )}
          {canOpenEquipment && (
            <Tabs.Panel value="equipment" pt="md">
              <EquipmentTab />
            </Tabs.Panel>
          )}
          {canDraftRx && contextEncounterId && (
            <Tabs.Panel value="prescriptions" pt="md">
              <NurseRxTab encounterId={contextEncounterId} patientId={contextPatientId} />
            </Tabs.Panel>
          )}
        </Tabs>
      )}
    </div>
  );
}

function NurseContextStrip({
  admissionId,
  encounterId,
  patientId,
  wardId,
  bedId,
  chargeable,
  chargeContext,
}: {
  admissionId: string;
  encounterId: string;
  patientId: string;
  wardId: string;
  bedId: string;
  chargeable: string;
  chargeContext: string;
}) {
  if (!admissionId && !encounterId && !patientId && !wardId && !bedId) {
    return null;
  }

  return (
    <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="xs" mb="md">
      <Card withBorder padding="sm">
        <Text size="xs" c="dimmed">
          Patient
        </Text>
        <Text size="sm" fw={600}>
          {patientId ? patientId.slice(0, 8) : "Not linked"}
        </Text>
      </Card>
      <Card withBorder padding="sm">
        <Text size="xs" c="dimmed">
          Admission
        </Text>
        <Text size="sm" fw={600}>
          {admissionId ? admissionId.slice(0, 8) : "Not linked"}
        </Text>
      </Card>
      <Card withBorder padding="sm">
        <Text size="xs" c="dimmed">
          Encounter
        </Text>
        <Text size="sm" fw={600}>
          {encounterId ? encounterId.slice(0, 8) : "Required for vitals and I/O"}
        </Text>
      </Card>
      <Card withBorder padding="sm">
        <Text size="xs" c="dimmed">
          Ward / Bed
        </Text>
        <Text size="sm" fw={600}>
          {[wardId ? `Ward ${wardId.slice(0, 8)}` : "", bedId ? `Bed ${bedId.slice(0, 8)}` : ""]
            .filter(Boolean)
            .join(" · ") || "Not linked"}
        </Text>
      </Card>
      <Card withBorder padding="sm">
        <Text size="xs" c="dimmed">
          Billing context
        </Text>
        <Text size="sm" fw={600}>
          {chargeContext || "clinical"}
          {chargeable ? ` · chargeable ${chargeable}` : ""}
        </Text>
      </Card>
    </SimpleGrid>
  );
}

// Stable per-day shift id. Once the real shift roster API ships,
// replace with `useCurrentShift().id`.
function dailyShiftId(): string {
  const d = new Date();
  return `shift-${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
}

// ── MAR Tab ─────────────────────────────────────────────────────────

// ── Vitals Tab ──────────────────────────────────────────────────────

// ── Safety Tab ──────────────────────────────────────────────────────
