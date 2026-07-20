import {
  Card,
  Group,
  NumberInput,
  SegmentedControl,
  Select,
  SimpleGrid,
  Slider,
  Stack,
  Tabs,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Timeline,
} from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { type CreateVitalRequest, P, type SetupUser, type Vital } from "@medbrains/types";
import {
  IconAlertTriangle,
  IconBandage,
  IconDeviceHeartMonitor,
  IconDroplet,
  IconPlus,
  IconShieldCheck,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { useSearchParams } from "react-router";
import { PageHeader, VitalsRecorder } from "@/components";
import { HandoffPanel } from "@/components/crdt/HandoffPanel";
import { NursingNotesPanel } from "@/components/crdt/NursingNotesPanel";
import { EncounterSelect } from "@/components/EncounterSelect";
import { PatientContextBanner } from "@/components/Patient/PatientContextBanner";
import { Alert, Badge, type BadgeTone, Button, toast } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { adminAccessService } from "@/services/adminAccess.service";
import { nurseActivitiesService } from "@/services/nurseActivities.service";
import { CodeBlueTab } from "./nurse-activities/code-blue-tab";
import { EquipmentTab } from "./nurse-activities/equipment-tab";
import { MarTab } from "./nurse-activities/mar-tab";
import { NurseRxTab } from "./nurse-activities/nurse-rx-tab";
import { compactId } from "./nurse-activities/shared";

interface IoEntryRow {
  id: string;
  encounter_id: string;
  recorded_at: string;
  category: string;
  direction: string;
  volume_ml: number;
  notes?: string | null;
}

interface VitalsScheduleRow {
  id: string;
  encounter_id: string;
  frequency_minutes: number;
  next_due_at: string;
  last_captured_at?: string | null;
}

interface PainEntryRow {
  id: string;
  recorded_at: string;
  scale: string;
  score: number;
  location?: string | null;
  intervention_taken?: string | null;
}

interface FallRiskRow {
  id: string;
  recorded_at: string;
  scale: string;
  score: number;
  risk_level: string;
}

interface WoundRow {
  id: string;
  recorded_at: string;
  body_site: string;
  classification?: string | null;
  stage?: string | null;
  dressing_type?: string | null;
  dressing_change_due_at?: string | null;
  notes?: string | null;
}

interface ShiftHandoffRow {
  id: string;
  encounter_id: string;
  outgoing_nurse_id: string;
  incoming_nurse_id: string;
  outgoing_signed_at?: string | null;
  incoming_signed_at?: string | null;
  situation?: string | null;
  background?: string | null;
  assessment?: string | null;
  recommendation?: string | null;
  completed_at?: string | null;
  created_at: string;
}

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

function toNumber(value: string | number, fallback = 0): number {
  if (typeof value === "number") {
    return value;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function encounterLocked(initialEncounterId: string): boolean {
  return initialEncounterId.length > 0;
}

function EncounterContextField({
  value,
  onChange,
  locked,
  patientId,
}: {
  value: string;
  onChange: (value: string) => void;
  locked: boolean;
  patientId?: string;
}) {
  if (locked) {
    return (
      <Card withBorder padding="sm">
        <Text size="xs" c="dimmed">
          Linked encounter
        </Text>
        <Text size="sm" fw={700}>
          {compactId(value)}
        </Text>
      </Card>
    );
  }

  if (patientId) {
    return (
      <EncounterSelect
        label="Encounter"
        value={value}
        patientId={patientId}
        onChange={(encounterId) => onChange(encounterId)}
      />
    );
  }

  return (
    <TextInput
      label="Encounter ID"
      value={value}
      onChange={(event) => onChange(event.currentTarget.value)}
      w={400}
      placeholder="Open from IPD to auto-link"
    />
  );
}

type ClinicalStatusTone = "good" | "low" | "high" | "critical" | "neutral";

interface ClinicalStatus {
  label: string;
  color: string;
  tone: ClinicalStatusTone;
  detail?: string;
}

const NEUTRAL_STATUS: ClinicalStatus = { label: "Not entered", color: "gray", tone: "neutral" };

function statusBadgeTone(color: string): BadgeTone {
  const m: Record<string, BadgeTone> = {
    success: "success",
    danger: "danger",
    warning: "warning",
    primary: "primary",
    info: "info",
    slate: "neutral",
    gray: "neutral",
    teal: "success",
    green: "success",
    red: "danger",
    yellow: "warning",
    orange: "warning",
    blue: "info",
    violet: "accent",
    cinnabar: "accent",
  };
  return (color ? m[color] : undefined) ?? "neutral";
}

function painStatus(score: number | undefined): ClinicalStatus {
  if (score === undefined) return NEUTRAL_STATUS;
  if (score <= 3) return { label: "Controlled", color: "green", tone: "good" };
  if (score <= 6) return { label: "Moderate", color: "orange", tone: "high" };
  return { label: "Severe", color: "red", tone: "critical" };
}

function fallRiskStatus(level: string | undefined, score?: number): ClinicalStatus {
  const normalized = level?.toLowerCase();
  if (normalized === "high" || (score !== undefined && score >= 45)) {
    return { label: "High risk", color: "red", tone: "critical" };
  }
  if (normalized === "moderate" || (score !== undefined && score >= 25)) {
    return { label: "Moderate risk", color: "orange", tone: "high" };
  }
  if (normalized === "low" || score !== undefined) {
    return { label: "Low risk", color: "green", tone: "good" };
  }
  return NEUTRAL_STATUS;
}

function woundStatus(row?: WoundRow): ClinicalStatus {
  if (!row) return NEUTRAL_STATUS;
  const stage = row.stage?.toLowerCase() ?? "";
  if (stage.includes("4") || stage.includes("3") || stage.includes("unstage")) {
    return { label: "High concern", color: "red", tone: "critical" };
  }
  if (stage.includes("2")) {
    return { label: "Monitor closely", color: "orange", tone: "high" };
  }
  return { label: "Active", color: "blue", tone: "neutral" };
}

function ioBalanceStatus(balance: number | undefined): ClinicalStatus {
  if (balance === undefined) return NEUTRAL_STATUS;
  const absolute = Math.abs(balance);
  if (absolute <= 250) {
    return { label: "Balanced", color: "green", tone: "good" };
  }
  if (absolute <= 1000) {
    return {
      label: balance > 0 ? "Positive balance" : "Negative balance",
      color: "orange",
      tone: balance > 0 ? "high" : "low",
    };
  }
  return {
    label: balance > 0 ? "High positive" : "High negative",
    color: "red",
    tone: "critical",
  };
}

function scheduleDueStatus(nextDueAt: string): ClinicalStatus {
  const minutes = Math.round((new Date(nextDueAt).getTime() - Date.now()) / 60_000);
  if (minutes <= 0) {
    return { label: "Overdue", color: "red", tone: "critical" };
  }
  if (minutes <= 15) {
    return { label: "Due soon", color: "orange", tone: "high" };
  }
  return { label: "Scheduled", color: "green", tone: "good" };
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString();
}

function formatMl(value: number | undefined): string {
  return `${value ?? 0} ml`;
}

function vitalDisplayValue(value: string | number | null | undefined, suffix: string): string {
  if (value === null || value === undefined || value === "") {
    return "";
  }
  return `${value}${suffix}`;
}

function ClinicalIndicatorCard({
  detail,
  icon,
  label,
  status,
  value,
}: {
  detail?: ReactNode;
  icon: ReactNode;
  label: string;
  status: ClinicalStatus;
  value: ReactNode;
}) {
  return (
    <Card withBorder padding="sm">
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Group gap="xs" align="flex-start" wrap="nowrap">
          <ThemeIcon color={status.color} variant="light" radius="md">
            {icon}
          </ThemeIcon>
          <Stack gap={1}>
            <Text size="xs" c="dimmed">
              {label}
            </Text>
            <Text size="sm" fw={700}>
              {value}
            </Text>
          </Stack>
        </Group>
        <Badge tone={statusBadgeTone(status.color)} size="sm">
          {status.label}
        </Badge>
      </Group>
      {detail && (
        <Text size="xs" c="dimmed" mt={6}>
          {detail}
        </Text>
      )}
    </Card>
  );
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

function IoTab({
  initialEncounterId,
  patientId,
}: {
  initialEncounterId: string;
  patientId: string;
}) {
  const canView = useHasPermission(P.NURSE.INTAKE_OUTPUT_VIEW);
  const canRecord = useHasPermission(P.NURSE.INTAKE_OUTPUT_RECORD);
  const isLinkedEncounter = encounterLocked(initialEncounterId);
  const [encounterId, setEncounterId] = useState(initialEncounterId);
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["io-entries", encounterId],
    queryFn: () => nurseActivitiesService.listIoForEncounter(encounterId) as Promise<IoEntryRow[]>,
    enabled: canView && encounterId.length > 0,
  });
  const { data: balance } = useQuery({
    queryKey: ["io-balance", encounterId],
    queryFn: () =>
      nurseActivitiesService.getEncounterIoBalance(encounterId, 24) as Promise<{
        intake_total: number;
        output_total: number;
        balance: number;
      }>,
    enabled: canView && encounterId.length > 0,
  });

  return (
    <Stack>
      <Group align="end">
        <EncounterContextField
          value={encounterId}
          onChange={setEncounterId}
          locked={isLinkedEncounter}
          patientId={patientId}
        />
        {isLinkedEncounter && <Badge tone="neutral">IPD linked</Badge>}
        {!canRecord && (
          <Text size="xs" c="dimmed" mt={28}>
            View only
          </Text>
        )}
      </Group>

      {balance && (
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
          <ClinicalIndicatorCard
            icon={<IconDroplet size={18} />}
            label="Intake (24h)"
            value={formatMl(balance.intake_total)}
            status={{ label: "In", color: "blue", tone: "neutral" }}
          />
          <ClinicalIndicatorCard
            icon={<IconDroplet size={18} />}
            label="Output (24h)"
            value={formatMl(balance.output_total)}
            status={{ label: "Out", color: "orange", tone: "neutral" }}
          />
          <ClinicalIndicatorCard
            icon={<IconDeviceHeartMonitor size={18} />}
            label="Net balance"
            value={`${balance.balance > 0 ? "+" : ""}${formatMl(balance.balance)}`}
            status={ioBalanceStatus(balance.balance)}
            detail="Green is within +/-250 ml; orange/red needs nurse review per ward protocol."
          />
        </SimpleGrid>
      )}

      {canRecord && (
        <CreateIoPanel
          encounterId={encounterId}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ["io-entries"] });
            qc.invalidateQueries({ queryKey: ["io-balance"] });
          }}
        />
      )}

      {canView ? (
        <Stack gap="xs">
          {data?.map((row) => (
            <Card key={row.id} withBorder padding="sm">
              <Group justify="space-between">
                <Group gap="xs">
                  <Badge tone={row.direction === "intake" ? "info" : "warning"}>
                    {row.direction}
                  </Badge>
                  <Text fw={500}>{row.category}</Text>
                  <Text>{row.volume_ml} ml</Text>
                </Group>
                <Text size="sm" c="dimmed">
                  {formatDateTime(row.recorded_at)}
                </Text>
              </Group>
              {row.notes && (
                <Text size="xs" c="dimmed" mt={4}>
                  {row.notes}
                </Text>
              )}
            </Card>
          ))}
        </Stack>
      ) : (
        <Text size="sm" c="dimmed">
          You can record intake/output, but history and balance require I/O view permission.
        </Text>
      )}
    </Stack>
  );
}

function CreateIoPanel({ encounterId, onCreated }: { encounterId: string; onCreated: () => void }) {
  const [direction, setDirection] = useState<"intake" | "output">("intake");
  const [category, setCategory] = useState("oral");
  const [volume, setVolume] = useState<number>(100);
  const [notes, setNotes] = useState("");
  const intakeCats = ["oral", "iv", "tube", "blood", "tpn", "other"];
  const outputCats = ["urine", "stool", "emesis", "drain", "other"];
  const directionStatus: ClinicalStatus =
    direction === "intake"
      ? { label: "Intake", color: "blue", tone: "neutral" }
      : { label: "Output", color: "orange", tone: "neutral" };

  const create = useMutation({
    mutationFn: () =>
      nurseActivitiesService.createIoEntry({
        encounter_id: encounterId,
        direction,
        category,
        volume_ml: volume,
        notes: notes || undefined,
      }),
    onSuccess: () => {
      onCreated();
      setVolume(100);
      setNotes("");
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not save I/O entry" }),
  });

  return (
    <Card withBorder padding="md">
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start">
          <Stack gap={2}>
            <Text fw={700}>Quick I/O Entry</Text>
            <Text size="xs" c="dimmed">
              Record every fluid input/output against the linked encounter.
            </Text>
          </Stack>
          <Badge tone={statusBadgeTone(directionStatus.color)}>{directionStatus.label}</Badge>
        </Group>
        <SimpleGrid cols={{ base: 1, md: 4 }} spacing="sm">
          <SegmentedControl
            value={direction}
            onChange={(value) => {
              const next = value === "output" ? "output" : "intake";
              setDirection(next);
              setCategory(next === "intake" ? "oral" : "urine");
            }}
            data={[
              { value: "intake", label: "Intake" },
              { value: "output", label: "Output" },
            ]}
          />
          <Select
            label="Category"
            data={direction === "intake" ? intakeCats : outputCats}
            value={category}
            onChange={(value) => value && setCategory(value)}
          />
          <NumberInput
            label="Volume"
            value={volume}
            onChange={(value) => setVolume(toNumber(value))}
            min={1}
            suffix=" ml"
          />
          <Button
            tone="primary"
            mt={{ base: 0, md: 24 }}
            leftSection={<IconPlus size={14} />}
            onClick={() => create.mutate()}
            loading={create.isPending}
            disabled={!encounterId || volume <= 0}
          >
            Save entry
          </Button>
        </SimpleGrid>
        <Textarea
          label="Notes"
          value={notes}
          onChange={(event) => setNotes(event.currentTarget.value)}
          autosize
          minRows={2}
        />
      </Stack>
    </Card>
  );
}

// ── Vitals Tab ──────────────────────────────────────────────────────

function VitalsTab({
  initialEncounterId,
  patientId,
}: {
  initialEncounterId: string;
  patientId: string;
}) {
  const qc = useQueryClient();
  const canView = useHasPermission(P.NURSE.VITALS_VIEW);
  const canRecord = useHasPermission(P.NURSE.VITALS_RECORD);
  const isLinkedEncounter = encounterLocked(initialEncounterId);
  const [encounterId, setEncounterId] = useState(initialEncounterId);
  const [frequency, setFrequency] = useState<number>(240);
  const [activeVitalsTab, setActiveVitalsTab] = useState<"record" | "timeline">("record");

  const { data: schedules, isLoading } = useQuery({
    queryKey: ["nurse-vitals-schedules", encounterId],
    queryFn: () =>
      nurseActivitiesService.listVitalsSchedules({ encounter_id: encounterId }) as Promise<
        VitalsScheduleRow[]
      >,
    enabled: canView && encounterId.length > 0,
  });
  const { data: vitals = [], isLoading: vitalsLoading } = useQuery({
    queryKey: ["nurse-vitals", encounterId],
    queryFn: () => nurseActivitiesService.listNurseVitals(encounterId) as Promise<Vital[]>,
    enabled: canView && encounterId.length > 0,
  });

  const createSchedule = useMutation({
    mutationFn: () =>
      nurseActivitiesService.createVitalsSchedule({
        encounter_id: encounterId,
        frequency_minutes: frequency,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["nurse-vitals-schedules"] }),
    onError: (e: Error) => toast.error(e.message, { title: "Could not create schedule" }),
  });

  const endSchedule = useMutation({
    mutationFn: (id: string) => nurseActivitiesService.endVitalsSchedule(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["nurse-vitals-schedules"] }),
    onError: (e: Error) => toast.error(e.message, { title: "Could not end schedule" }),
  });

  const recordVitals = useMutation({
    mutationFn: (data: CreateVitalRequest) =>
      nurseActivitiesService.createNurseVital({
        ...data,
        encounter_id: encounterId,
      }) as Promise<Vital>,
    onSuccess: (row) => {
      qc.setQueryData<Vital[]>(["nurse-vitals", encounterId], (current = []) => [
        row,
        ...current.filter((item) => item.id !== row.id),
      ]);
      void qc.invalidateQueries({ queryKey: ["nurse-vitals-schedules"] });
      void qc.invalidateQueries({ queryKey: ["nurse-vitals", encounterId] });
      if (canView) {
        setActiveVitalsTab("timeline");
      }
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not record vitals" }),
  });

  return (
    <Stack>
      <Group align="end">
        <EncounterContextField
          value={encounterId}
          onChange={setEncounterId}
          locked={isLinkedEncounter}
          patientId={patientId}
        />
        <NumberInput
          label="Repeat vitals due every"
          value={frequency}
          onChange={(value) => setFrequency(toNumber(value, 240))}
          min={15}
          step={15}
          suffix=" min"
          w={160}
        />
        <Button
          tone="primary"
          onClick={() => createSchedule.mutate()}
          loading={createSchedule.isPending}
          disabled={!encounterId || !canRecord}
        >
          Set frequency
        </Button>
      </Group>

      <Card withBorder padding="md">
        <Stack>
          <Group justify="space-between">
            <Stack gap={2}>
              <Text fw={700}>Vitals Capture</Text>
              <Text size="xs" c="dimmed">
                Same configured vitals component used in OPD, linked to this nursing encounter.
              </Text>
            </Stack>
            {isLinkedEncounter && <Badge tone="neutral">IPD linked</Badge>}
          </Group>
          <Tabs
            value={activeVitalsTab}
            onChange={(value) => {
              if (value === "record" || value === "timeline") {
                setActiveVitalsTab(value);
              }
            }}
            keepMounted={false}
          >
            <Tabs.List>
              <Tabs.Tab value="record">Record</Tabs.Tab>
              {canView && <Tabs.Tab value="timeline">Timeline</Tabs.Tab>}
            </Tabs.List>

            <Tabs.Panel value="record" pt="md">
              <Stack>
                {!encounterId && (
                  <Alert tone="warning" icon={<IconAlertTriangle size={16} />}>
                    Select or open a linked encounter before recording vitals.
                  </Alert>
                )}
                {canRecord && encounterId ? (
                  <VitalsRecorder
                    onSubmit={(data) => recordVitals.mutate(data)}
                    isSubmitting={recordVitals.isPending}
                  />
                ) : (
                  <Text size="sm" c="dimmed">
                    {canRecord
                      ? "Vitals can be recorded after an encounter is linked."
                      : "You can view schedules and timeline, but recording vitals is not available for this role."}
                  </Text>
                )}
              </Stack>
            </Tabs.Panel>

            {canView && (
              <Tabs.Panel value="timeline" pt="md">
                <VitalsTimeline vitals={vitals} isLoading={vitalsLoading} />
              </Tabs.Panel>
            )}
          </Tabs>
        </Stack>
      </Card>

      {canView ? (
        <>
          {isLoading && <Text c="dimmed">Loading schedules...</Text>}
          <Stack gap="xs">
            {schedules?.map((row) => (
              <Card key={row.id} withBorder padding="sm">
                <Group justify="space-between">
                  <Stack gap={2}>
                    <Group gap="xs">
                      <Text fw={600}>Every {row.frequency_minutes} min</Text>
                      <Badge tone={statusBadgeTone(scheduleDueStatus(row.next_due_at).color)}>
                        {scheduleDueStatus(row.next_due_at).label}
                      </Badge>
                    </Group>
                    <Text size="xs" c="dimmed">
                      Next due {formatDateTime(row.next_due_at)}
                      {row.last_captured_at
                        ? ` · Last ${formatDateTime(row.last_captured_at)}`
                        : ""}
                    </Text>
                  </Stack>
                  {canRecord && (
                    <Button
                      tone="secondary"
                      size="xs"
                      onClick={() => endSchedule.mutate(row.id)}
                      loading={endSchedule.isPending}
                    >
                      End
                    </Button>
                  )}
                </Group>
              </Card>
            ))}
          </Stack>
        </>
      ) : (
        <Text size="sm" c="dimmed">
          You can record vitals, but schedules and timeline require vitals view permission.
        </Text>
      )}
    </Stack>
  );
}

function VitalsTimeline({ vitals, isLoading }: { vitals: Vital[]; isLoading: boolean }) {
  if (isLoading) {
    return <Text c="dimmed">Loading vitals timeline...</Text>;
  }

  if (vitals.length === 0) {
    return <Text c="dimmed">No vitals recorded for this encounter yet.</Text>;
  }

  return (
    <Timeline active={0} bulletSize={30} lineWidth={2} color="primary">
      {vitals.map((row, index) => (
        <Timeline.Item
          key={row.id}
          bullet={<IconDeviceHeartMonitor size={15} />}
          title={
            <Group gap="xs">
              <Text size="sm" fw={700}>
                {formatDateTime(row.recorded_at)}
              </Text>
              {index === 0 && (
                <Badge tone="success" size="xs">
                  Latest
                </Badge>
              )}
            </Group>
          }
        >
          <Group gap="xs" mt={5} wrap="wrap">
            {vitalDisplayValue(row.temperature, " C") && (
              <Badge tone="neutral">{vitalDisplayValue(row.temperature, " C")}</Badge>
            )}
            {vitalDisplayValue(row.pulse, " bpm") && (
              <Badge tone="neutral">{vitalDisplayValue(row.pulse, " bpm")}</Badge>
            )}
            {row.systolic_bp != null && row.diastolic_bp != null && (
              <Badge tone="neutral">
                BP {row.systolic_bp}/{row.diastolic_bp}
              </Badge>
            )}
            {vitalDisplayValue(row.spo2, "% SpO2") && (
              <Badge tone="neutral">{vitalDisplayValue(row.spo2, "% SpO2")}</Badge>
            )}
            {vitalDisplayValue(row.respiratory_rate, "/min RR") && (
              <Badge tone="neutral">{vitalDisplayValue(row.respiratory_rate, "/min RR")}</Badge>
            )}
            {vitalDisplayValue(row.weight_kg, " kg") && (
              <Badge tone="neutral" variant="outline">
                {vitalDisplayValue(row.weight_kg, " kg")}
              </Badge>
            )}
            {vitalDisplayValue(row.height_cm, " cm") && (
              <Badge tone="neutral" variant="outline">
                {vitalDisplayValue(row.height_cm, " cm")}
              </Badge>
            )}
            {vitalDisplayValue(row.bmi, " BMI") && (
              <Badge tone="neutral" variant="outline">
                {vitalDisplayValue(row.bmi, " BMI")}
              </Badge>
            )}
          </Group>
          {row.notes && (
            <Text size="xs" c="dimmed" mt={6}>
              {row.notes}
            </Text>
          )}
        </Timeline.Item>
      ))}
    </Timeline>
  );
}

// ── Safety Tab ──────────────────────────────────────────────────────

function SafetyTab({
  initialEncounterId,
  patientId,
}: {
  initialEncounterId: string;
  patientId: string;
}) {
  const qc = useQueryClient();
  const canViewPain = useHasPermission(P.NURSE.PAIN_VIEW);
  const canRecordPain = useHasPermission(P.NURSE.PAIN_RECORD);
  const canViewFallRisk = useHasPermission(P.NURSE.FALL_RISK_VIEW);
  const canRecordFallRisk = useHasPermission(P.NURSE.FALL_RISK_RECORD);
  const canViewWound = useHasPermission(P.NURSE.WOUND_VIEW);
  const canRecordWound = useHasPermission(P.NURSE.WOUND_RECORD);
  const isLinkedEncounter = encounterLocked(initialEncounterId);
  const [encounterId, setEncounterId] = useState(initialEncounterId);
  const [painScore, setPainScore] = useState<number>(0);
  const [painLocation, setPainLocation] = useState("");
  const [painCharacter, setPainCharacter] = useState("");
  const [painIntervention, setPainIntervention] = useState("");
  const [fallScore, setFallScore] = useState<number>(0);
  const [fallLevel, setFallLevel] = useState("low");
  const [woundSite, setWoundSite] = useState("");
  const [woundClassification, setWoundClassification] = useState("pressure_injury");
  const [woundStage, setWoundStage] = useState("");
  const [woundDressing, setWoundDressing] = useState("");
  const [woundNotes, setWoundNotes] = useState("");

  const { data: painRows } = useQuery({
    queryKey: ["nurse-pain", encounterId],
    queryFn: () =>
      nurseActivitiesService.listPainForEncounter(encounterId) as Promise<PainEntryRow[]>,
    enabled: canViewPain && encounterId.length > 0,
  });
  const { data: fallRows } = useQuery({
    queryKey: ["nurse-fall-risk", encounterId],
    queryFn: () =>
      nurseActivitiesService.listFallRiskForEncounter(encounterId) as Promise<FallRiskRow[]>,
    enabled: canViewFallRisk && encounterId.length > 0,
  });
  const { data: woundRows } = useQuery({
    queryKey: ["nurse-wounds", encounterId],
    queryFn: () =>
      nurseActivitiesService.listWoundsForEncounter(encounterId) as Promise<WoundRow[]>,
    enabled: canViewWound && encounterId.length > 0,
  });

  const createPain = useMutation({
    mutationFn: () =>
      nurseActivitiesService.createPainEntry({
        encounter_id: encounterId,
        scale: "NRS",
        score: painScore,
        location: painLocation.trim() || undefined,
        character: painCharacter.trim() || undefined,
        intervention_taken: painIntervention.trim() || undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["nurse-pain"] });
      setPainScore(0);
      setPainLocation("");
      setPainCharacter("");
      setPainIntervention("");
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not save pain assessment" }),
  });

  const createFallRisk = useMutation({
    mutationFn: () =>
      nurseActivitiesService.createFallRisk({
        encounter_id: encounterId,
        scale: "Morse",
        score: fallScore,
        risk_level: fallLevel,
        interventions:
          fallLevel === "high"
            ? ["bed_low", "bed_alarm", "assisted_mobility", "supervisor_review"]
            : fallLevel === "moderate"
              ? ["bed_low", "assisted_mobility"]
              : ["routine_rounding"],
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["nurse-fall-risk"] });
      setFallScore(0);
      setFallLevel("low");
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not save fall-risk assessment" }),
  });

  const createWound = useMutation({
    mutationFn: () =>
      nurseActivitiesService.createWound({
        encounter_id: encounterId,
        body_site: woundSite.trim(),
        classification: woundClassification,
        stage: woundStage.trim() || undefined,
        dressing_type: woundDressing.trim() || undefined,
        notes: woundNotes.trim() || undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["nurse-wounds"] });
      setWoundSite("");
      setWoundClassification("pressure_injury");
      setWoundStage("");
      setWoundDressing("");
      setWoundNotes("");
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not save wound record" }),
  });

  const latestPainStatus = painStatus(painRows?.[0]?.score);
  const currentPainStatus = painStatus(painScore);
  const latestFallStatus = fallRiskStatus(fallRows?.[0]?.risk_level, fallRows?.[0]?.score);
  const currentFallStatus = fallRiskStatus(fallLevel, fallScore);
  const latestWoundStatus = woundStatus(woundRows?.[0]);
  const canOpenPain = canViewPain || canRecordPain;
  const canOpenFallRisk = canViewFallRisk || canRecordFallRisk;
  const canOpenWound = canViewWound || canRecordWound;

  return (
    <Stack>
      <Group align="end">
        <EncounterContextField
          value={encounterId}
          onChange={setEncounterId}
          locked={isLinkedEncounter}
          patientId={patientId}
        />
        {isLinkedEncounter && <Badge tone="neutral">IPD linked</Badge>}
      </Group>
      {!encounterId && (
        <Alert tone="warning" icon={<IconAlertTriangle size={16} />}>
          Open Nurse Activities from an IPD admission to pre-link pain, fall-risk and wound entries
          to the active encounter.
        </Alert>
      )}
      <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
        {canOpenPain && (
          <Card withBorder padding="md">
            <Stack gap="sm">
              <Group justify="space-between">
                <Group gap="xs">
                  <ThemeIcon color={latestPainStatus.color} variant="light" radius="md">
                    <IconAlertTriangle size={18} />
                  </ThemeIcon>
                  <Text fw={700}>Pain</Text>
                </Group>
                <Badge tone={statusBadgeTone(latestPainStatus.color)}>
                  Latest {painRows?.[0]?.score ?? "-"}
                </Badge>
              </Group>
              {canRecordPain && (
                <>
                  <Group justify="space-between">
                    <Text size="sm" fw={600}>
                      NRS score
                    </Text>
                    <Badge tone={statusBadgeTone(currentPainStatus.color)}>
                      {currentPainStatus.label}
                    </Badge>
                  </Group>
                  <Slider
                    value={painScore}
                    onChange={setPainScore}
                    min={0}
                    max={10}
                    step={1}
                    marks={[
                      { value: 0, label: "0" },
                      { value: 5, label: "5" },
                      { value: 10, label: "10" },
                    ]}
                  />
                  <Select
                    label="Character"
                    value={painCharacter || null}
                    onChange={(value) => setPainCharacter(value ?? "")}
                    data={[
                      { value: "aching", label: "Aching" },
                      { value: "burning", label: "Burning" },
                      { value: "cramping", label: "Cramping" },
                      { value: "sharp", label: "Sharp" },
                      { value: "throbbing", label: "Throbbing" },
                    ]}
                    clearable
                  />
                  <TextInput
                    label="Location"
                    value={painLocation}
                    onChange={(event) => setPainLocation(event.currentTarget.value)}
                  />
                  <Textarea
                    label="Intervention"
                    value={painIntervention}
                    onChange={(event) => setPainIntervention(event.currentTarget.value)}
                    minRows={2}
                  />
                  <Button
                    tone="primary"
                    size="xs"
                    leftSection={<IconPlus size={14} />}
                    onClick={() => createPain.mutate()}
                    loading={createPain.isPending}
                    disabled={!encounterId}
                  >
                    Record pain
                  </Button>
                </>
              )}
              {canViewPain ? (
                painRows?.slice(0, 3).map((row) => (
                  <Group key={row.id} gap="xs" wrap="nowrap">
                    <Badge tone={statusBadgeTone(painStatus(row.score).color)} size="xs">
                      {row.score}/10
                    </Badge>
                    <Text size="xs" c="dimmed">
                      {row.location ? `${row.location} · ` : ""}
                      {formatDateTime(row.recorded_at)}
                    </Text>
                  </Group>
                ))
              ) : (
                <Text size="xs" c="dimmed">
                  Pain history requires pain view permission.
                </Text>
              )}
            </Stack>
          </Card>
        )}
        {canOpenFallRisk && (
          <Card withBorder padding="md">
            <Stack gap="sm">
              <Group justify="space-between">
                <Group gap="xs">
                  <ThemeIcon color={latestFallStatus.color} variant="light" radius="md">
                    <IconShieldCheck size={18} />
                  </ThemeIcon>
                  <Text fw={700}>Fall Risk</Text>
                </Group>
                <Badge tone={statusBadgeTone(latestFallStatus.color)}>
                  {fallRows?.[0]?.risk_level ?? "No score"}
                </Badge>
              </Group>
              {canRecordFallRisk && (
                <>
                  <Group justify="space-between">
                    <Text size="sm" fw={600}>
                      Morse assessment
                    </Text>
                    <Badge tone={statusBadgeTone(currentFallStatus.color)}>
                      {currentFallStatus.label}
                    </Badge>
                  </Group>
                  <NumberInput
                    label="Morse score"
                    value={fallScore}
                    onChange={(value) => setFallScore(toNumber(value))}
                    min={0}
                  />
                  <Select
                    label="Risk level"
                    value={fallLevel}
                    onChange={(value) => value && setFallLevel(value)}
                    data={[
                      { value: "low", label: "Low" },
                      { value: "moderate", label: "Moderate" },
                      { value: "high", label: "High" },
                    ]}
                  />
                  <Button
                    tone="primary"
                    size="xs"
                    leftSection={<IconPlus size={14} />}
                    onClick={() => createFallRisk.mutate()}
                    loading={createFallRisk.isPending}
                    disabled={!encounterId}
                  >
                    Record fall risk
                  </Button>
                </>
              )}
              {canViewFallRisk ? (
                fallRows?.slice(0, 3).map((row) => (
                  <Group key={row.id} gap="xs" wrap="nowrap">
                    <Badge
                      tone={statusBadgeTone(fallRiskStatus(row.risk_level, row.score).color)}
                      size="xs"
                    >
                      {row.risk_level}
                    </Badge>
                    <Text size="xs" c="dimmed">
                      {row.scale} {row.score} · {formatDateTime(row.recorded_at)}
                    </Text>
                  </Group>
                ))
              ) : (
                <Text size="xs" c="dimmed">
                  Fall-risk history requires fall-risk view permission.
                </Text>
              )}
            </Stack>
          </Card>
        )}
        {canOpenWound && (
          <Card withBorder padding="md">
            <Stack gap="sm">
              <Group justify="space-between">
                <Group gap="xs">
                  <ThemeIcon color={latestWoundStatus.color} variant="light" radius="md">
                    <IconBandage size={18} />
                  </ThemeIcon>
                  <Text fw={700}>Wounds</Text>
                </Group>
                <Badge tone={statusBadgeTone(latestWoundStatus.color)}>
                  {woundRows?.length ?? 0} active
                </Badge>
              </Group>
              {canRecordWound && (
                <>
                  <Select
                    label="Classification"
                    value={woundClassification}
                    onChange={(value) => value && setWoundClassification(value)}
                    data={[
                      { value: "pressure_injury", label: "Pressure injury" },
                      { value: "surgical", label: "Surgical" },
                      { value: "traumatic", label: "Traumatic" },
                      { value: "diabetic_foot", label: "Diabetic foot" },
                      { value: "other", label: "Other" },
                    ]}
                  />
                  <TextInput
                    label="Body site"
                    value={woundSite}
                    onChange={(event) => setWoundSite(event.currentTarget.value)}
                  />
                  <Select
                    label="Stage"
                    value={woundStage || null}
                    onChange={(value) => setWoundStage(value ?? "")}
                    placeholder="Stage 1, Stage 2, surgical, pressure"
                    data={[
                      { value: "stage_1", label: "Stage 1" },
                      { value: "stage_2", label: "Stage 2" },
                      { value: "stage_3", label: "Stage 3" },
                      { value: "stage_4", label: "Stage 4" },
                      { value: "unstageable", label: "Unstageable" },
                      { value: "not_applicable", label: "Not applicable" },
                    ]}
                    clearable
                  />
                  <TextInput
                    label="Dressing"
                    value={woundDressing}
                    onChange={(event) => setWoundDressing(event.currentTarget.value)}
                    placeholder="Foam, hydrocolloid, gauze"
                  />
                  <Textarea
                    label="Wound note"
                    value={woundNotes}
                    onChange={(event) => setWoundNotes(event.currentTarget.value)}
                    minRows={2}
                  />
                  <Button
                    tone="primary"
                    size="xs"
                    leftSection={<IconPlus size={14} />}
                    onClick={() => createWound.mutate()}
                    loading={createWound.isPending}
                    disabled={!encounterId || !woundSite.trim()}
                  >
                    Record wound
                  </Button>
                </>
              )}
              {canViewWound ? (
                woundRows?.slice(0, 3).map((row) => (
                  <Group key={row.id} gap="xs" wrap="nowrap">
                    <Badge tone={statusBadgeTone(woundStatus(row).color)} size="xs">
                      {row.stage ?? row.classification ?? "wound"}
                    </Badge>
                    <Text size="xs" c="dimmed">
                      {row.body_site} · {formatDateTime(row.recorded_at)}
                    </Text>
                  </Group>
                ))
              ) : (
                <Text size="xs" c="dimmed">
                  Wound history requires wound view permission.
                </Text>
              )}
            </Stack>
          </Card>
        )}
      </SimpleGrid>
    </Stack>
  );
}

// ── Handoff Tab ─────────────────────────────────────────────────────

function HandoffWorkflowPanel({
  initialEncounterId,
  patientId,
}: {
  initialEncounterId: string;
  patientId: string;
}) {
  const qc = useQueryClient();
  const canView = useHasPermission(P.NURSE.HANDOFF_VIEW);
  const canRecord = useHasPermission(P.NURSE.HANDOFF_RECORD);
  const canListUsers = useHasPermission(P.ADMIN.USERS.LIST);
  const isLinkedEncounter = encounterLocked(initialEncounterId);
  const [encounterId, setEncounterId] = useState(initialEncounterId);
  const [incomingNurseId, setIncomingNurseId] = useState("");
  const [situation, setSituation] = useState("");
  const [background, setBackground] = useState("");
  const [assessment, setAssessment] = useState("");
  const [recommendation, setRecommendation] = useState("");

  const { data: users = [] } = useQuery({
    queryKey: ["handoff-nurse-users"],
    queryFn: () => adminAccessService.listUsers(),
    enabled: canListUsers,
    staleTime: 300_000,
  });
  const nurseUsers = (users as SetupUser[]).filter((user) => {
    const role = user.role.toLowerCase();
    return user.is_active && (role.includes("nurse") || role.includes("matron"));
  });
  const incomingOptions = (nurseUsers.length > 0 ? nurseUsers : (users as SetupUser[]))
    .filter((user) => user.is_active)
    .map((user) => ({
      value: user.id,
      label: `${user.full_name} · ${user.role}`,
    }));

  const { data: handoffs = [], isLoading } = useQuery({
    queryKey: ["nurse-handoffs", encounterId],
    queryFn: () =>
      nurseActivitiesService.listHandoffsForEncounter(encounterId) as Promise<ShiftHandoffRow[]>,
    enabled: canView && encounterId.length > 0,
  });

  const createHandoff = useMutation({
    mutationFn: () =>
      nurseActivitiesService.createHandoff({
        encounter_id: encounterId,
        incoming_nurse_id: incomingNurseId,
        situation: situation.trim() || undefined,
        background: background.trim() || undefined,
        assessment: assessment.trim() || undefined,
        recommendation: recommendation.trim() || undefined,
        alerts: [],
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["nurse-handoffs"] });
      setIncomingNurseId("");
      setSituation("");
      setBackground("");
      setAssessment("");
      setRecommendation("");
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not create handoff" }),
  });

  const acceptHandoff = useMutation({
    mutationFn: (id: string) => nurseActivitiesService.acceptHandoff(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["nurse-handoffs"] }),
    onError: (e: Error) => toast.error(e.message, { title: "Could not accept handoff" }),
  });

  return (
    <Card withBorder padding="md">
      <Stack>
        <Group justify="space-between" align="flex-start">
          <Stack gap={2}>
            <Text fw={700}>Patient Handoff</Text>
            <Text size="xs" c="dimmed">
              Transfer bedside responsibility to the incoming nurse using SBAR.
            </Text>
          </Stack>
          {isLinkedEncounter && <Badge tone="neutral">IPD linked</Badge>}
        </Group>

        <Group align="end">
          <EncounterContextField
            value={encounterId}
            onChange={setEncounterId}
            locked={isLinkedEncounter}
            patientId={patientId}
          />
          <Select
            label="Incoming nurse"
            placeholder={canListUsers ? "Select receiving nurse" : "Roster picker unavailable"}
            data={incomingOptions}
            value={incomingNurseId || null}
            onChange={(value) => setIncomingNurseId(value ?? "")}
            searchable
            disabled={!canRecord || !canListUsers}
            w={320}
          />
        </Group>

        {!canListUsers && (
          <Text size="xs" c="dimmed">
            The final handoff picker should come from the shift roster. Until that route exists,
            users with staff-list permission can choose the incoming nurse here.
          </Text>
        )}

        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
          <Textarea
            label="Situation"
            value={situation}
            onChange={(event) => setSituation(event.currentTarget.value)}
            minRows={2}
          />
          <Textarea
            label="Background"
            value={background}
            onChange={(event) => setBackground(event.currentTarget.value)}
            minRows={2}
          />
          <Textarea
            label="Assessment"
            value={assessment}
            onChange={(event) => setAssessment(event.currentTarget.value)}
            minRows={2}
          />
          <Textarea
            label="Recommendation"
            value={recommendation}
            onChange={(event) => setRecommendation(event.currentTarget.value)}
            minRows={2}
          />
        </SimpleGrid>

        <Group justify="flex-end">
          <Button
            tone="primary"
            onClick={() => createHandoff.mutate()}
            loading={createHandoff.isPending}
            disabled={!encounterId || !incomingNurseId || !canRecord}
          >
            Sign handoff
          </Button>
        </Group>

        {canView ? (
          <>
            {isLoading && <Text c="dimmed">Loading handoffs...</Text>}
            <Stack gap="xs">
              {handoffs.map((row) => (
                <Card key={row.id} withBorder padding="sm">
                  <Group justify="space-between" align="flex-start">
                    <Stack gap={2}>
                      <Group gap="xs">
                        <Badge tone={row.completed_at ? "success" : "warning"}>
                          {row.completed_at ? "Accepted" : "Awaiting incoming nurse"}
                        </Badge>
                        <Text size="xs" c="dimmed">
                          To {compactId(row.incoming_nurse_id)}
                        </Text>
                      </Group>
                      <Text size="sm" fw={600}>
                        {row.situation || "No situation entered"}
                      </Text>
                      {row.recommendation && (
                        <Text size="xs" c="dimmed">
                          Recommendation: {row.recommendation}
                        </Text>
                      )}
                    </Stack>
                    {!row.completed_at && canRecord && (
                      <Button
                        tone="secondary"
                        size="xs"
                        onClick={() => acceptHandoff.mutate(row.id)}
                        loading={acceptHandoff.isPending}
                      >
                        Accept
                      </Button>
                    )}
                  </Group>
                </Card>
              ))}
            </Stack>
          </>
        ) : (
          <Text size="sm" c="dimmed">
            You can sign handoffs, but handoff history requires handoff view permission.
          </Text>
        )}
      </Stack>
    </Card>
  );
}

// ── Code Blue Tab ───────────────────────────────────────────────────

/** Nurse-draft prescription writer — Rx-only items route to a doctor to countersign. */
