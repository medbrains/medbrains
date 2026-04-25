import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  Divider,
  Drawer,
  Group,
  Modal,
  NumberInput,
  Paper,
  Select,
  Stack,
  Tabs,
  Text,
  TextInput,
  Textarea,
  ThemeIcon,
  Title,
  Tooltip,
} from "@mantine/core";
import { PatientSearchSelect } from "../components/PatientSearchSelect";
import { BedSelect } from "../components/BedSelect";
import { DoctorSearchSelect } from "../components/DoctorSearchSelect";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconBuildingHospital,
  IconPlus,
  IconUrgent,
  IconHeartbeat,
  IconAlertTriangle,
  IconGavel,
  IconUsers,
  IconCheck,
  IconBell,
  IconClock,
  IconShieldCheck,
  IconFileText,
  IconScale,
  IconAlertOctagon,
  IconFirstAidKit,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import type {
  ErVisit,
  ErCodeActivation,
  MlcCase,
  MlcDocument,
  MassCasualtyEvent,
  CreateErVisitRequest,
  CreateCodeActivationRequest,
  CreateMlcCaseRequest,
  CreateMlcDocumentRequest,
  CreateMassCasualtyEventRequest,
  AdmitFromErRequest,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { useHasPermission } from "@medbrains/stores";
import { useRequirePermission } from "../hooks/useRequirePermission";
import { DataTable, PageHeader } from "../components";

// ── Constants ──────────────────────────────────────────

const ARRIVAL_MODES = [
  { value: "walk_in", label: "Walk-in" },
  { value: "ambulance", label: "Ambulance" },
  { value: "police", label: "Police" },
  { value: "referred", label: "Referred" },
];

const CODE_TYPES = [
  { value: "code_blue", label: "Code Blue (Cardiac Arrest)" },
  { value: "code_yellow", label: "Code Yellow (Mass Casualty)" },
  { value: "code_pink", label: "Code Pink (Child Abduction)" },
  { value: "code_orange", label: "Code Orange (Hazmat)" },
  { value: "code_red", label: "Code Red (Fire)" },
  { value: "code_silver", label: "Code Silver (Active Threat)" },
  { value: "code_black", label: "Code Black (Bomb Threat)" },
];

const MLC_CASE_TYPES = [
  { value: "assault", label: "Assault" },
  { value: "rta", label: "Road Traffic Accident" },
  { value: "burn", label: "Burns" },
  { value: "poisoning", label: "Poisoning" },
  { value: "sexual_assault", label: "Sexual Assault" },
  { value: "suicide_attempt", label: "Suicide Attempt" },
  { value: "unknown", label: "Unknown" },
];

const MASS_CASUALTY_TYPES = [
  { value: "natural_disaster", label: "Natural Disaster" },
  { value: "industrial", label: "Industrial Accident" },
  { value: "transport", label: "Transport Accident" },
  { value: "violence", label: "Violence" },
  { value: "other", label: "Other" },
];

const CRASH_CART_ITEMS = [
  { key: "defibrillator_present", label: "Defibrillator present and functional" },
  { key: "defibrillator_charge_test", label: "Defibrillator charge test passed" },
  { key: "airway_equipment", label: "Airway equipment (ETT, laryngoscope, ambu bag)" },
  { key: "iv_access_supplies", label: "IV access supplies (cannulas, fluids, sets)" },
  { key: "adrenaline", label: "Adrenaline (Epinephrine) 1mg ampoules" },
  { key: "atropine", label: "Atropine 0.6mg ampoules" },
  { key: "amiodarone", label: "Amiodarone 150mg ampoules" },
  { key: "suction_equipment", label: "Suction equipment functional" },
  { key: "oxygen_supply", label: "Oxygen supply connected and flowing" },
  { key: "monitor_leads", label: "Cardiac monitor leads and pads" },
];

// ── Triage helpers ────────────────────────────────────

interface TriageInfo {
  color: string;
  label: string;
  level: number;
}

function triageInfo(level: string | null): TriageInfo {
  switch (level) {
    case "immediate": return { color: "danger", label: "RED - Immediate", level: 1 };
    case "emergent": return { color: "orange", label: "ORANGE - Emergent", level: 2 };
    case "urgent": return { color: "warning", label: "YELLOW - Urgent", level: 3 };
    case "less_urgent": return { color: "success", label: "GREEN - Delayed", level: 4 };
    case "non_urgent": return { color: "primary", label: "BLUE - Non-Urgent", level: 5 };
    case "expectant": return { color: "dark", label: "BLACK - Expectant", level: 6 };
    default: return { color: "slate", label: "Unassigned", level: 0 };
  }
}

function statusColor(status: string): string {
  switch (status) {
    case "registered": return "primary";
    case "triaged": return "cyan";
    case "in_treatment": return "orange";
    case "observation": return "warning";
    case "admitted": return "teal";
    case "discharged": return "success";
    case "transferred": return "violet";
    case "lama": return "danger";
    case "deceased": return "dark";
    default: return "gray";
  }
}

// ── Timer Hook ─────────────────────────────────────────

function useTimer(startTime: string | null, endIndicator: number | null): string {
  const [elapsed, setElapsed] = useState("");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const formatDuration = useCallback((ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
      return `${hours}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
    }
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }, []);

  useEffect(() => {
    if (!startTime) {
      setElapsed("");
      return;
    }

    const start = new Date(startTime).getTime();

    // Doctor already seen — show static duration
    if (endIndicator !== null && endIndicator !== undefined) {
      setElapsed(`${endIndicator} min`);
      return;
    }

    // Live ticking timer
    const update = () => {
      const now = Date.now();
      const diff = now - start;
      setElapsed(formatDuration(diff > 0 ? diff : 0));
    };
    update();
    intervalRef.current = setInterval(update, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [startTime, endIndicator, formatDuration]);

  return elapsed;
}

// ── Inline Timer Component ────────────────────────────

function WaitTimeBadge({ arrivalTime, doorToDoctorMins }: { arrivalTime: string; doorToDoctorMins: number | null }) {
  const display = useTimer(arrivalTime, doorToDoctorMins);

  if (!display) return <Text size="sm" c="dimmed">--</Text>;

  if (doorToDoctorMins !== null && doorToDoctorMins !== undefined) {
    return (
      <Badge color="success" variant="light" size="lg" leftSection={<IconCheck size={12} />}>
        {display}
      </Badge>
    );
  }

  return (
    <Badge color="orange" variant="filled" size="lg" leftSection={<IconClock size={12} />}>
      {display}
    </Badge>
  );
}

// ── Main Page ──────────────────────────────────────────

export function EmergencyPage() {
  useRequirePermission(P.EMERGENCY.VISITS_LIST);

  const canCreateVisit = useHasPermission(P.EMERGENCY.VISITS_CREATE);
  const canCreateCode = useHasPermission(P.EMERGENCY.CODES_CREATE);
  const canCreateMlc = useHasPermission(P.EMERGENCY.MLC_CREATE);
  const canCreateMassCasualty = useHasPermission(P.EMERGENCY.MASS_CASUALTY_CREATE);

  const [activeTab, setActiveTab] = useState<string | null>("visits");

  return (
    <div>
      <PageHeader
        title="Emergency Department"
        subtitle="ER visits, triage, MLC management, mass casualty"
      />
      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="visits" leftSection={<IconUrgent size={16} />}>ER Visits</Tabs.Tab>
          <Tabs.Tab value="codes" leftSection={<IconHeartbeat size={16} />}>Code Activations</Tabs.Tab>
          <Tabs.Tab value="mlc" leftSection={<IconGavel size={16} />}>MLC Cases</Tabs.Tab>
          <Tabs.Tab value="mass-casualty" leftSection={<IconUsers size={16} />}>Mass Casualty</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="visits"><VisitsTab canCreate={canCreateVisit} /></Tabs.Panel>
        <Tabs.Panel value="codes"><CodesTab canCreate={canCreateCode} /></Tabs.Panel>
        <Tabs.Panel value="mlc"><MlcTab canCreate={canCreateMlc} /></Tabs.Panel>
        <Tabs.Panel value="mass-casualty"><MassCasualtyTab canCreate={canCreateMassCasualty} /></Tabs.Panel>
      </Tabs>
    </div>
  );
}

// ── ER Visits Tab ──────────────────────────────────────

function VisitsTab({ canCreate }: { canCreate: boolean }) {
  const [opened, { open, close }] = useDisclosure(false);
  const [admitOpen, admitHandlers] = useDisclosure(false);
  const [admitVisitId, setAdmitVisitId] = useState<string | null>(null);
  const canAdmit = useHasPermission(P.EMERGENCY.VISITS_UPDATE);
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ["er-visits"], queryFn: () => api.listErVisits() });

  const [form, setForm] = useState<CreateErVisitRequest>({ patient_id: "" });
  const mutation = useMutation({
    mutationFn: (d: CreateErVisitRequest) => api.createErVisit(d),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["er-visits"] }); close(); notifications.show({ title: "Success", message: "ER visit registered" }); },
  });

  // Admit from ER
  const [admitForm, setAdmitForm] = useState<Partial<AdmitFromErRequest>>({});
  const admitMutation = useMutation({
    mutationFn: ({ visitId, data: d }: { visitId: string; data: AdmitFromErRequest }) =>
      api.admitFromEr(visitId, d),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["er-visits"] });
      notifications.show({ title: "Patient Admitted", message: "Patient has been admitted to IPD from ER", color: "success" });
      setAdmitForm({});
      setAdmitVisitId(null);
      admitHandlers.close();
    },
  });

  const handleOpenAdmit = (visitId: string) => {
    setAdmitVisitId(visitId);
    setAdmitForm({});
    admitHandlers.open();
  };

  const columns = [
    { key: "visit_number", label: "Visit #", render: (r: ErVisit) => <Text fw={600}>{r.visit_number}</Text> },
    { key: "arrival_time", label: "Arrival", render: (r: ErVisit) => new Date(r.arrival_time).toLocaleString() },
    { key: "arrival_mode", label: "Mode", render: (r: ErVisit) => r.arrival_mode ?? "---" },
    { key: "chief_complaint", label: "Chief Complaint", render: (r: ErVisit) => r.chief_complaint ?? "---" },
    {
      key: "triage_level",
      label: "Triage",
      render: (r: ErVisit) => {
        const info = triageInfo(r.triage_level);
        if (!r.triage_level) {
          return <Badge color="slate" size="lg" variant="outline">Unassigned</Badge>;
        }
        return (
          <Badge
            color={info.color}
            size="lg"
            variant="filled"
            leftSection={
              <ThemeIcon color={info.color} size="xs" radius="xl" variant="white">
                <Text size="xs" fw={900}>{info.level}</Text>
              </ThemeIcon>
            }
          >
            {info.label}
          </Badge>
        );
      },
    },
    { key: "status", label: "Status", render: (r: ErVisit) => <Badge color={statusColor(r.status)} size="sm">{r.status}</Badge> },
    { key: "is_mlc", label: "MLC", render: (r: ErVisit) => r.is_mlc ? <Badge color="danger" size="sm">MLC</Badge> : null },
    { key: "bay_number", label: "Bay", render: (r: ErVisit) => r.bay_number ?? "---" },
    {
      key: "wait_time",
      label: "Wait Time",
      render: (r: ErVisit) => <WaitTimeBadge arrivalTime={r.arrival_time} doorToDoctorMins={r.door_to_doctor_mins} />,
    },
    {
      key: "actions",
      label: "",
      render: (r: ErVisit) => {
        const canShowAdmit = canAdmit && ["registered", "triaged", "in_treatment", "observation"].includes(r.status);
        if (!canShowAdmit) return null;
        return (
          <Tooltip label="Admit to IPD">
            <Button
              size="xs"
              variant="light"
              color="teal"
              leftSection={<IconBuildingHospital size={14} />}
              onClick={() => handleOpenAdmit(r.id)}
            >
              Admit
            </Button>
          </Tooltip>
        );
      },
    },
  ];

  return (
    <Stack mt="md">
      {canCreate && (
        <Group justify="flex-end">
          <Button leftSection={<IconPlus size={16} />} onClick={open}>Register ER Visit</Button>
        </Group>
      )}
      <DataTable columns={columns} data={data} loading={isLoading} rowKey={(r) => r.id} />

      <Drawer opened={opened} onClose={close} title="Register ER Visit" position="right" size="xl">
        <Stack>
          <PatientSearchSelect value={form.patient_id} onChange={(v) => setForm({ ...form, patient_id: v })} required />
          <Select label="Arrival Mode" data={ARRIVAL_MODES} value={form.arrival_mode ?? null} onChange={(v) => setForm({ ...form, arrival_mode: v ?? undefined })} />
          <TextInput label="Chief Complaint" value={form.chief_complaint ?? ""} onChange={(e) => setForm({ ...form, chief_complaint: e.currentTarget.value })} />
          <TextInput label="Bay Number" value={form.bay_number ?? ""} onChange={(e) => setForm({ ...form, bay_number: e.currentTarget.value })} />
          <Select label="MLC" data={[{ value: "true", label: "Yes" }, { value: "false", label: "No" }]} value={form.is_mlc ? "true" : "false"} onChange={(v) => setForm({ ...form, is_mlc: v === "true" })} />
          <Textarea label="Notes" value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.currentTarget.value })} />
          <Button onClick={() => mutation.mutate(form)} loading={mutation.isPending}>Register</Button>
        </Stack>
      </Drawer>

      {/* Admit to IPD Modal */}
      <Modal
        opened={admitOpen}
        onClose={() => { admitHandlers.close(); setAdmitVisitId(null); setAdmitForm({}); }}
        title="Admit Patient to IPD"
        size="md"
      >
        <Stack>
          <BedSelect
            value={admitForm.bed_id ?? ""}
            onChange={(id) => setAdmitForm({ ...admitForm, bed_id: id })}
            required
          />
          <DoctorSearchSelect
            label="Admitting Doctor"
            value={admitForm.admitting_doctor_id ?? ""}
            onChange={(id) => setAdmitForm({ ...admitForm, admitting_doctor_id: id })}
            required
          />
          <Textarea
            label="Admission Notes"
            value={admitForm.admission_notes ?? ""}
            onChange={(e) => setAdmitForm({ ...admitForm, admission_notes: e.currentTarget.value })}
            placeholder="Reason for admission, clinical notes..."
            minRows={3}
          />
          <Button
            color="teal"
            leftSection={<IconBuildingHospital size={16} />}
            onClick={() => {
              if (!admitVisitId || !admitForm.bed_id || !admitForm.admitting_doctor_id) return;
              admitMutation.mutate({
                visitId: admitVisitId,
                data: {
                  bed_id: admitForm.bed_id,
                  admitting_doctor_id: admitForm.admitting_doctor_id,
                  admission_notes: admitForm.admission_notes,
                },
              });
            }}
            loading={admitMutation.isPending}
          >
            Confirm Admission
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}

// ── Code Activations Tab ──────────────────────────────

function CrashCartChecklist({
  value,
  onChange,
}: {
  value: Record<string, boolean>;
  onChange: (updated: Record<string, boolean>) => void;
}) {
  const allChecked = CRASH_CART_ITEMS.every((item) => value[item.key] === true);
  const checkedCount = CRASH_CART_ITEMS.filter((item) => value[item.key] === true).length;

  return (
    <Card withBorder p="md">
      <Group justify="space-between" mb="sm">
        <Group gap="xs">
          <IconFirstAidKit size={20} />
          <Title order={5}>Crash Cart Checklist</Title>
        </Group>
        <Badge color={allChecked ? "success" : "orange"} variant="light">
          {checkedCount}/{CRASH_CART_ITEMS.length}
        </Badge>
      </Group>
      <Divider mb="sm" />
      <Stack gap="xs">
        {CRASH_CART_ITEMS.map((item) => (
          <Checkbox
            key={item.key}
            label={item.label}
            checked={value[item.key] === true}
            onChange={(e) => onChange({ ...value, [item.key]: e.currentTarget.checked })}
          />
        ))}
      </Stack>
    </Card>
  );
}

function CodesTab({ canCreate }: { canCreate: boolean }) {
  const [opened, { open, close }] = useDisclosure(false);
  const [detailOpened, { open: openDetail, close: closeDetail }] = useDisclosure(false);
  const [selectedCode, setSelectedCode] = useState<ErCodeActivation | null>(null);
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ["er-codes"], queryFn: () => api.listCodeActivations() });

  const [form, setForm] = useState<CreateCodeActivationRequest>({ code_type: "" });
  const [crashCart, setCrashCart] = useState<Record<string, boolean>>({});

  const createMut = useMutation({
    mutationFn: (d: CreateCodeActivationRequest) => api.createCodeActivation(d),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["er-codes"] });
      close();
      setCrashCart({});
      notifications.show({ title: "Code Activated", message: `${form.code_type.toUpperCase()} activated`, color: "danger" });
    },
  });

  const deactivateMut = useMutation({
    mutationFn: (id: string) => api.deactivateCode(id, {}),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["er-codes"] }); notifications.show({ title: "Code Deactivated", message: "Code has been deactivated" }); },
  });

  const handleCreate = () => {
    const hasCheckedItems = Object.values(crashCart).some((v) => v);
    const payload: CreateCodeActivationRequest = {
      ...form,
      crash_cart_checklist: hasCheckedItems ? crashCart : undefined,
    };
    createMut.mutate(payload);
  };

  const handleViewDetail = (code: ErCodeActivation) => {
    setSelectedCode(code);
    openDetail();
  };

  const columns = [
    { key: "code_type", label: "Code", render: (r: ErCodeActivation) => <Badge color={r.code_type === "blue" ? "primary" : r.code_type === "yellow" ? "warning" : "orange"} size="lg">CODE {r.code_type.toUpperCase()}</Badge> },
    { key: "activated_at", label: "Activated", render: (r: ErCodeActivation) => new Date(r.activated_at).toLocaleString() },
    { key: "location", label: "Location", render: (r: ErCodeActivation) => r.location ?? "---" },
    { key: "outcome", label: "Outcome", render: (r: ErCodeActivation) => r.outcome ?? "---" },
    { key: "deactivated_at", label: "Status", render: (r: ErCodeActivation) => r.deactivated_at ? <Badge color="success" size="sm">Resolved</Badge> : <Badge color="danger" size="sm">Active</Badge> },
    {
      key: "crash_cart", label: "Crash Cart", render: (r: ErCodeActivation) => {
        const checklist = r.crash_cart_checklist as Record<string, boolean> | null;
        if (!checklist) return <Text size="sm" c="dimmed">Not checked</Text>;
        const checked = Object.values(checklist).filter(Boolean).length;
        const total = CRASH_CART_ITEMS.length;
        return (
          <Badge color={checked === total ? "success" : "orange"} variant="light" size="sm">
            {checked}/{total}
          </Badge>
        );
      },
    },
    {
      key: "actions", label: "", render: (r: ErCodeActivation) => (
        <Group gap="xs">
          <Tooltip label="View Details">
            <ActionIcon variant="light" onClick={() => handleViewDetail(r)}>
              <IconFileText size={16} />
            </ActionIcon>
          </Tooltip>
          {!r.deactivated_at && canCreate && (
            <Tooltip label="Deactivate">
              <ActionIcon color="success" variant="light" onClick={() => deactivateMut.mutate(r.id)}>
                <IconCheck size={16} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
      ),
    },
  ];

  const selectedChecklist = selectedCode?.crash_cart_checklist as Record<string, boolean> | null;

  return (
    <Stack mt="md">
      {canCreate && (
        <Group justify="flex-end">
          <Button leftSection={<IconAlertTriangle size={16} />} color="danger" onClick={open}>Activate Code</Button>
        </Group>
      )}
      <DataTable columns={columns} data={data} loading={isLoading} rowKey={(r) => r.id} />

      {/* Create Code Drawer */}
      <Drawer opened={opened} onClose={() => { close(); setCrashCart({}); }} title="Activate Emergency Code" position="right" size="lg">
        <Stack>
          <Select label="Code Type" required data={CODE_TYPES} value={form.code_type || null} onChange={(v) => setForm({ ...form, code_type: v ?? "" })} />
          <TextInput label="Location" value={form.location ?? ""} onChange={(e) => setForm({ ...form, location: e.currentTarget.value })} />
          <Textarea label="Notes" value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.currentTarget.value })} />
          <Divider />
          <CrashCartChecklist value={crashCart} onChange={setCrashCart} />
          <Button color="danger" onClick={handleCreate} loading={createMut.isPending}>Activate Code</Button>
        </Stack>
      </Drawer>

      {/* Code Detail Drawer */}
      <Drawer opened={detailOpened} onClose={closeDetail} title="Code Activation Details" position="right" size="lg">
        {selectedCode && (
          <Stack>
            <Group>
              <Badge color={selectedCode.code_type === "blue" ? "primary" : "orange"} size="xl">
                CODE {selectedCode.code_type.toUpperCase()}
              </Badge>
              {selectedCode.deactivated_at ? (
                <Badge color="success" size="lg">Resolved</Badge>
              ) : (
                <Badge color="danger" size="lg">Active</Badge>
              )}
            </Group>
            <Text size="sm"><Text span fw={600}>Activated:</Text> {new Date(selectedCode.activated_at).toLocaleString()}</Text>
            {selectedCode.deactivated_at && (
              <Text size="sm"><Text span fw={600}>Deactivated:</Text> {new Date(selectedCode.deactivated_at).toLocaleString()}</Text>
            )}
            {selectedCode.location && (
              <Text size="sm"><Text span fw={600}>Location:</Text> {selectedCode.location}</Text>
            )}
            {selectedCode.outcome && (
              <Text size="sm"><Text span fw={600}>Outcome:</Text> {selectedCode.outcome}</Text>
            )}
            {selectedCode.notes && (
              <Text size="sm"><Text span fw={600}>Notes:</Text> {selectedCode.notes}</Text>
            )}

            <Divider />
            <Title order={5}>Crash Cart Checklist</Title>
            {selectedChecklist ? (
              <Card withBorder p="md">
                <Stack gap="xs">
                  {CRASH_CART_ITEMS.map((item) => (
                    <Group key={item.key} gap="xs">
                      {selectedChecklist[item.key] ? (
                        <ThemeIcon color="success" size="sm" radius="xl"><IconCheck size={12} /></ThemeIcon>
                      ) : (
                        <ThemeIcon color="danger" size="sm" radius="xl" variant="light"><IconAlertTriangle size={12} /></ThemeIcon>
                      )}
                      <Text size="sm" c={selectedChecklist[item.key] ? undefined : "danger"}>{item.label}</Text>
                    </Group>
                  ))}
                </Stack>
              </Card>
            ) : (
              <Text size="sm" c="dimmed">No crash cart checklist was recorded for this activation.</Text>
            )}
          </Stack>
        )}
      </Drawer>
    </Stack>
  );
}

// ── MLC Cases Tab ──────────────────────────────────────

interface SbarForm {
  situation: string;
  background: string;
  assessment: string;
  recommendation: string;
}

interface AgeEstimationForm {
  ossification_center_findings: string;
  dental_examination: string;
  secondary_sexual_characteristics: string;
  estimated_age_range: string;
  examiner_opinion: string;
}

interface PocsoReportForm {
  child_age: string;
  guardian_details: string;
  statement_summary: string;
  injuries_documented: string;
  psych_assessment_needed: boolean;
}

interface CourtSummonsForm {
  date: string;
  court_name: string;
  case_number: string;
  status: string;
  notes: string;
}

const EMPTY_SBAR: SbarForm = { situation: "", background: "", assessment: "", recommendation: "" };
const EMPTY_AGE_EST: AgeEstimationForm = { ossification_center_findings: "", dental_examination: "", secondary_sexual_characteristics: "", estimated_age_range: "", examiner_opinion: "" };
const EMPTY_POCSO: PocsoReportForm = { child_age: "", guardian_details: "", statement_summary: "", injuries_documented: "", psych_assessment_needed: false };
const EMPTY_SUMMONS: CourtSummonsForm = { date: "", court_name: "", case_number: "", status: "pending", notes: "" };

function MlcCaseDetail({
  mlcCase,
}: {
  mlcCase: MlcCase;
}) {
  const qc = useQueryClient();

  // Sub-drawer state
  const [sbarOpened, { open: openSbar, close: closeSbar }] = useDisclosure(false);
  const [ageEstOpened, { open: openAgeEst, close: closeAgeEst }] = useDisclosure(false);
  const [pocsoOpened, { open: openPocso, close: closePocso }] = useDisclosure(false);
  const [summonsOpened, { open: openSummons, close: closeSummons }] = useDisclosure(false);

  // Forms
  const [sbarForm, setSbarForm] = useState<SbarForm>({ ...EMPTY_SBAR });
  const [ageEstForm, setAgeEstForm] = useState<AgeEstimationForm>({ ...EMPTY_AGE_EST });
  const [pocsoForm, setPocsoForm] = useState<PocsoReportForm>({ ...EMPTY_POCSO });
  const [summonsForm, setSummonsForm] = useState<CourtSummonsForm>({ ...EMPTY_SUMMONS });

  // Fetch documents for this MLC case
  const { data: documents = [] } = useQuery({
    queryKey: ["mlc-documents", mlcCase.id],
    queryFn: () => api.listMlcDocuments(mlcCase.id),
  });

  const createDocMut = useMutation({
    mutationFn: (data: CreateMlcDocumentRequest) => api.createMlcDocument(mlcCase.id, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["mlc-documents", mlcCase.id] });
      notifications.show({ title: "Document Created", message: "MLC document saved successfully" });
    },
  });

  // SBAR submit
  const handleSbarSubmit = () => {
    createDocMut.mutate({
      document_type: "sbar_handover",
      title: `SBAR Handover - ${mlcCase.mlc_number}`,
      content: { ...sbarForm },
    });
    closeSbar();
    setSbarForm({ ...EMPTY_SBAR });
  };

  // Age estimation submit
  const handleAgeEstSubmit = () => {
    createDocMut.mutate({
      document_type: "age_estimation",
      title: `Age Estimation - ${mlcCase.mlc_number}`,
      content: { ...ageEstForm },
    });
    closeAgeEst();
    setAgeEstForm({ ...EMPTY_AGE_EST });
  };

  // POCSO report submit
  const handlePocsoSubmit = () => {
    createDocMut.mutate({
      document_type: "pocso_report",
      title: `POCSO Report - ${mlcCase.mlc_number}`,
      content: { ...pocsoForm },
    });
    closePocso();
    setPocsoForm({ ...EMPTY_POCSO });
  };

  // Court summons submit
  const handleSummonsSubmit = () => {
    createDocMut.mutate({
      document_type: "court_summons",
      title: `Court Summons - ${summonsForm.court_name}`,
      content: { ...summonsForm },
    });
    closeSummons();
    setSummonsForm({ ...EMPTY_SUMMONS });
  };

  // Filter documents by type
  const sbarDocs = documents.filter((d) => d.document_type === "sbar_handover");
  const ageEstDocs = documents.filter((d) => d.document_type === "age_estimation");
  const pocsoDocs = documents.filter((d) => d.document_type === "pocso_report");
  const courtSummonsDocs = documents.filter((d) => d.document_type === "court_summons");

  return (
    <>
      <Stack>
        {/* POCSO Banner */}
        {mlcCase.is_pocso && (
          <Alert
            color="danger"
            variant="filled"
            icon={<IconAlertOctagon size={20} />}
            title="POCSO Case"
          >
            This is a POCSO (Protection of Children from Sexual Offences) case. All documentation must comply with POCSO Act, 2012. Ensure child-friendly procedures and mandatory reporting to police/SJPU within 24 hours.
          </Alert>
        )}

        {/* Case Info */}
        <Card withBorder p="md">
          <Group justify="space-between" mb="xs">
            <Title order={5}>{mlcCase.mlc_number}</Title>
            <Group gap="xs">
              {mlcCase.is_pocso && <Badge color="danger" size="lg">POCSO</Badge>}
              {mlcCase.is_death_case && <Badge color="dark" size="lg">Death Case</Badge>}
              <Badge color={mlcCase.status === "closed" ? "success" : "orange"} size="lg">{mlcCase.status}</Badge>
            </Group>
          </Group>
          <Text size="sm"><Text span fw={600}>Type:</Text> {mlcCase.case_type ?? "---"}</Text>
          <Text size="sm"><Text span fw={600}>Registered:</Text> {new Date(mlcCase.registered_at).toLocaleString()}</Text>
          {mlcCase.fir_number && <Text size="sm"><Text span fw={600}>FIR #:</Text> {mlcCase.fir_number}</Text>}
          {mlcCase.police_station && <Text size="sm"><Text span fw={600}>Police Station:</Text> {mlcCase.police_station}</Text>}
          {mlcCase.history_of_incident && <Text size="sm"><Text span fw={600}>History:</Text> {mlcCase.history_of_incident}</Text>}
        </Card>

        {/* Action Buttons */}
        <Group>
          <Button leftSection={<IconShieldCheck size={16} />} variant="light" onClick={openSbar}>SBAR Handover</Button>
          <Button leftSection={<IconScale size={16} />} variant="light" color="violet" onClick={openAgeEst}>Age Estimation</Button>
          {mlcCase.is_pocso && (
            <Button leftSection={<IconAlertOctagon size={16} />} variant="light" color="danger" onClick={openPocso}>POCSO Report</Button>
          )}
          <Button leftSection={<IconGavel size={16} />} variant="light" color="warning" onClick={openSummons}>Add Court Summons</Button>
        </Group>

        <Divider />

        {/* SBAR Handover Documents */}
        {sbarDocs.length > 0 && (
          <Box>
            <Title order={6} mb="xs">SBAR Handover Records</Title>
            <Stack gap="xs">
              {sbarDocs.map((doc) => {
                const c = doc.content as Record<string, string>;
                return (
                  <Card key={doc.id} withBorder p="sm">
                    <Text size="xs" c="dimmed" mb="xs">{new Date(doc.created_at).toLocaleString()}</Text>
                    <Text size="sm"><Text span fw={600}>S:</Text> {c.situation || "---"}</Text>
                    <Text size="sm"><Text span fw={600}>B:</Text> {c.background || "---"}</Text>
                    <Text size="sm"><Text span fw={600}>A:</Text> {c.assessment || "---"}</Text>
                    <Text size="sm"><Text span fw={600}>R:</Text> {c.recommendation || "---"}</Text>
                  </Card>
                );
              })}
            </Stack>
          </Box>
        )}

        {/* Age Estimation Documents */}
        {ageEstDocs.length > 0 && (
          <Box>
            <Title order={6} mb="xs">Age Estimation Reports</Title>
            <Stack gap="xs">
              {ageEstDocs.map((doc) => {
                const c = doc.content as Record<string, string>;
                return (
                  <Card key={doc.id} withBorder p="sm">
                    <Text size="xs" c="dimmed" mb="xs">{new Date(doc.created_at).toLocaleString()}</Text>
                    <Text size="sm"><Text span fw={600}>Ossification:</Text> {c.ossification_center_findings || "---"}</Text>
                    <Text size="sm"><Text span fw={600}>Dental:</Text> {c.dental_examination || "---"}</Text>
                    <Text size="sm"><Text span fw={600}>Secondary Sexual:</Text> {c.secondary_sexual_characteristics || "---"}</Text>
                    <Text size="sm"><Text span fw={600}>Estimated Range:</Text> {c.estimated_age_range || "---"}</Text>
                    <Text size="sm"><Text span fw={600}>Opinion:</Text> {c.examiner_opinion || "---"}</Text>
                  </Card>
                );
              })}
            </Stack>
          </Box>
        )}

        {/* POCSO Reports */}
        {pocsoDocs.length > 0 && (
          <Box>
            <Title order={6} mb="xs">POCSO Reports</Title>
            <Stack gap="xs">
              {pocsoDocs.map((doc) => {
                const c = doc.content as Record<string, unknown>;
                return (
                  <Card key={doc.id} withBorder p="sm">
                    <Text size="xs" c="dimmed" mb="xs">{new Date(doc.created_at).toLocaleString()}</Text>
                    <Text size="sm"><Text span fw={600}>Child Age:</Text> {String(c.child_age || "---")}</Text>
                    <Text size="sm"><Text span fw={600}>Guardian:</Text> {String(c.guardian_details || "---")}</Text>
                    <Text size="sm"><Text span fw={600}>Statement:</Text> {String(c.statement_summary || "---")}</Text>
                    <Text size="sm"><Text span fw={600}>Injuries:</Text> {String(c.injuries_documented || "---")}</Text>
                    <Text size="sm"><Text span fw={600}>Psych Assessment Needed:</Text> {c.psych_assessment_needed ? "Yes" : "No"}</Text>
                  </Card>
                );
              })}
            </Stack>
          </Box>
        )}

        {/* Court Summons */}
        <Box>
          <Group justify="space-between" mb="xs">
            <Title order={6}>Court Summons</Title>
            <Badge variant="light">{courtSummonsDocs.length} record(s)</Badge>
          </Group>
          {courtSummonsDocs.length > 0 ? (
            <Paper withBorder>
              <DataTable
                columns={[
                  {
                    key: "date",
                    label: "Date",
                    render: (d: MlcDocument) => {
                      const c = d.content as Record<string, string>;
                      return c.date ? new Date(c.date).toLocaleDateString() : "---";
                    },
                  },
                  {
                    key: "court_name",
                    label: "Court",
                    render: (d: MlcDocument) => {
                      const c = d.content as Record<string, string>;
                      return c.court_name || "---";
                    },
                  },
                  {
                    key: "case_number",
                    label: "Case #",
                    render: (d: MlcDocument) => {
                      const c = d.content as Record<string, string>;
                      return c.case_number || "---";
                    },
                  },
                  {
                    key: "status",
                    label: "Status",
                    render: (d: MlcDocument) => {
                      const c = d.content as Record<string, string>;
                      const s = c.status || "pending";
                      const color = s === "attended" ? "success" : s === "adjourned" ? "warning" : s === "pending" ? "primary" : "slate";
                      return <Badge color={color} size="sm">{s}</Badge>;
                    },
                  },
                  {
                    key: "created_at",
                    label: "Created",
                    render: (d: MlcDocument) => new Date(d.created_at).toLocaleString(),
                  },
                ]}
                data={courtSummonsDocs}
                loading={false}
                rowKey={(r) => r.id}
              />
            </Paper>
          ) : (
            <Text size="sm" c="dimmed">No court summons recorded.</Text>
          )}
        </Box>
      </Stack>

      {/* SBAR Handover Drawer */}
      <Drawer opened={sbarOpened} onClose={() => { closeSbar(); setSbarForm({ ...EMPTY_SBAR }); }} title="SBAR Handover" position="right" size="lg">
        <Stack>
          <Alert color="primary" variant="light" icon={<IconShieldCheck size={16} />}>
            SBAR (Situation-Background-Assessment-Recommendation) is a standardized communication tool for clinical handovers as recommended by WHO and NABH.
          </Alert>
          <Textarea
            label="Situation"
            description="Concise statement of the problem: who is the patient, what is the current concern?"
            value={sbarForm.situation}
            onChange={(e) => setSbarForm({ ...sbarForm, situation: e.currentTarget.value })}
            minRows={3}
            required
          />
          <Textarea
            label="Background"
            description="Pertinent history, context: relevant medical history, current medications, allergies, lab results"
            value={sbarForm.background}
            onChange={(e) => setSbarForm({ ...sbarForm, background: e.currentTarget.value })}
            minRows={3}
            required
          />
          <Textarea
            label="Assessment"
            description="Your clinical assessment: what you think the problem is"
            value={sbarForm.assessment}
            onChange={(e) => setSbarForm({ ...sbarForm, assessment: e.currentTarget.value })}
            minRows={3}
            required
          />
          <Textarea
            label="Recommendation"
            description="What you need: specific request, action needed, timeline"
            value={sbarForm.recommendation}
            onChange={(e) => setSbarForm({ ...sbarForm, recommendation: e.currentTarget.value })}
            minRows={3}
            required
          />
          <Button
            onClick={handleSbarSubmit}
            loading={createDocMut.isPending}
            disabled={!sbarForm.situation || !sbarForm.background || !sbarForm.assessment || !sbarForm.recommendation}
          >
            Save SBAR Handover
          </Button>
        </Stack>
      </Drawer>

      {/* Age Estimation Drawer */}
      <Drawer opened={ageEstOpened} onClose={() => { closeAgeEst(); setAgeEstForm({ ...EMPTY_AGE_EST }); }} title="Age Estimation Documentation" position="right" size="lg">
        <Stack>
          <Alert color="violet" variant="light" icon={<IconScale size={16} />}>
            Age estimation is a medico-legal procedure. Document all findings carefully. Ensure the examination is conducted by an authorized medical officer.
          </Alert>
          <Textarea
            label="Ossification Center Findings"
            description="X-ray findings of wrist, elbow, pelvis, and other ossification centers"
            value={ageEstForm.ossification_center_findings}
            onChange={(e) => setAgeEstForm({ ...ageEstForm, ossification_center_findings: e.currentTarget.value })}
            minRows={3}
            required
          />
          <Textarea
            label="Dental Examination"
            description="Eruption of teeth, third molar status, dental age assessment"
            value={ageEstForm.dental_examination}
            onChange={(e) => setAgeEstForm({ ...ageEstForm, dental_examination: e.currentTarget.value })}
            minRows={3}
            required
          />
          <Textarea
            label="Secondary Sexual Characteristics"
            description="Development stage as per Tanner staging"
            value={ageEstForm.secondary_sexual_characteristics}
            onChange={(e) => setAgeEstForm({ ...ageEstForm, secondary_sexual_characteristics: e.currentTarget.value })}
            minRows={3}
            required
          />
          <TextInput
            label="Estimated Age Range"
            description="e.g., 16-18 years"
            value={ageEstForm.estimated_age_range}
            onChange={(e) => setAgeEstForm({ ...ageEstForm, estimated_age_range: e.currentTarget.value })}
            required
          />
          <Textarea
            label="Examiner Opinion"
            description="Final opinion on probable age with reasoning"
            value={ageEstForm.examiner_opinion}
            onChange={(e) => setAgeEstForm({ ...ageEstForm, examiner_opinion: e.currentTarget.value })}
            minRows={3}
            required
          />
          <Button
            color="violet"
            onClick={handleAgeEstSubmit}
            loading={createDocMut.isPending}
            disabled={
              !ageEstForm.ossification_center_findings ||
              !ageEstForm.dental_examination ||
              !ageEstForm.estimated_age_range ||
              !ageEstForm.examiner_opinion
            }
          >
            Save Age Estimation
          </Button>
        </Stack>
      </Drawer>

      {/* POCSO Report Drawer */}
      <Drawer opened={pocsoOpened} onClose={() => { closePocso(); setPocsoForm({ ...EMPTY_POCSO }); }} title="POCSO Report" position="right" size="lg">
        <Stack>
          <Alert color="danger" variant="filled" icon={<IconAlertOctagon size={16} />}>
            POCSO Act, 2012 mandates mandatory reporting. This report is a legal document. Ensure child-friendly language and procedures throughout.
          </Alert>
          <TextInput
            label="Child Age"
            description="Age of the child victim"
            value={pocsoForm.child_age}
            onChange={(e) => setPocsoForm({ ...pocsoForm, child_age: e.currentTarget.value })}
            required
          />
          <Textarea
            label="Guardian Details"
            description="Name, relation, contact of guardian/parent accompanying the child"
            value={pocsoForm.guardian_details}
            onChange={(e) => setPocsoForm({ ...pocsoForm, guardian_details: e.currentTarget.value })}
            minRows={2}
            required
          />
          <Textarea
            label="Statement Summary"
            description="Summary of statement in the child's own words (do not lead or suggest)"
            value={pocsoForm.statement_summary}
            onChange={(e) => setPocsoForm({ ...pocsoForm, statement_summary: e.currentTarget.value })}
            minRows={4}
            required
          />
          <Textarea
            label="Injuries Documented"
            description="Clinical findings: injuries, marks, physical examination findings"
            value={pocsoForm.injuries_documented}
            onChange={(e) => setPocsoForm({ ...pocsoForm, injuries_documented: e.currentTarget.value })}
            minRows={3}
            required
          />
          <Checkbox
            label="Psychological assessment needed"
            checked={pocsoForm.psych_assessment_needed}
            onChange={(e) => setPocsoForm({ ...pocsoForm, psych_assessment_needed: e.currentTarget.checked })}
          />
          <Button
            color="danger"
            onClick={handlePocsoSubmit}
            loading={createDocMut.isPending}
            disabled={
              !pocsoForm.child_age ||
              !pocsoForm.guardian_details ||
              !pocsoForm.statement_summary ||
              !pocsoForm.injuries_documented
            }
          >
            Save POCSO Report
          </Button>
        </Stack>
      </Drawer>

      {/* Court Summons Drawer */}
      <Drawer opened={summonsOpened} onClose={() => { closeSummons(); setSummonsForm({ ...EMPTY_SUMMONS }); }} title="Add Court Summons" position="right" size="md">
        <Stack>
          <TextInput
            label="Date"
            type="date"
            value={summonsForm.date}
            onChange={(e) => setSummonsForm({ ...summonsForm, date: e.currentTarget.value })}
            required
          />
          <TextInput
            label="Court Name"
            value={summonsForm.court_name}
            onChange={(e) => setSummonsForm({ ...summonsForm, court_name: e.currentTarget.value })}
            required
          />
          <TextInput
            label="Case Number"
            value={summonsForm.case_number}
            onChange={(e) => setSummonsForm({ ...summonsForm, case_number: e.currentTarget.value })}
            required
          />
          <Select
            label="Status"
            data={[
              { value: "pending", label: "Pending" },
              { value: "attended", label: "Attended" },
              { value: "adjourned", label: "Adjourned" },
              { value: "cancelled", label: "Cancelled" },
            ]}
            value={summonsForm.status}
            onChange={(v) => setSummonsForm({ ...summonsForm, status: v ?? "pending" })}
          />
          <Textarea
            label="Notes"
            value={summonsForm.notes}
            onChange={(e) => setSummonsForm({ ...summonsForm, notes: e.currentTarget.value })}
          />
          <Button
            color="warning"
            onClick={handleSummonsSubmit}
            loading={createDocMut.isPending}
            disabled={!summonsForm.date || !summonsForm.court_name || !summonsForm.case_number}
          >
            Save Court Summons
          </Button>
        </Stack>
      </Drawer>
    </>
  );
}

function MlcTab({ canCreate }: { canCreate: boolean }) {
  const [opened, { open, close }] = useDisclosure(false);
  const [detailOpened, { open: openDetail, close: closeDetail }] = useDisclosure(false);
  const [selectedCase, setSelectedCase] = useState<MlcCase | null>(null);
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ["mlc-cases"], queryFn: () => api.listMlcCases() });

  const [form, setForm] = useState<CreateMlcCaseRequest>({ patient_id: "" });
  const mutation = useMutation({
    mutationFn: (d: CreateMlcCaseRequest) => api.createMlcCase(d),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["mlc-cases"] }); close(); notifications.show({ title: "Success", message: "MLC case registered" }); },
  });

  const mlcStatusColor = (s: string) => {
    switch (s) {
      case "registered": return "primary";
      case "under_investigation": return "orange";
      case "opinion_given": return "teal";
      case "court_pending": return "warning";
      case "closed": return "success";
      default: return "gray";
    }
  };

  const handleViewCase = (mlc: MlcCase) => {
    setSelectedCase(mlc);
    openDetail();
  };

  const columns = [
    { key: "mlc_number", label: "MLC #", render: (r: MlcCase) => <Text fw={600}>{r.mlc_number}</Text> },
    { key: "registered_at", label: "Registered", render: (r: MlcCase) => new Date(r.registered_at).toLocaleString() },
    { key: "case_type", label: "Type", render: (r: MlcCase) => r.case_type ?? "---" },
    { key: "status", label: "Status", render: (r: MlcCase) => <Badge color={mlcStatusColor(r.status)} size="sm">{r.status}</Badge> },
    { key: "fir_number", label: "FIR #", render: (r: MlcCase) => r.fir_number ?? "---" },
    { key: "police_station", label: "Police Station", render: (r: MlcCase) => r.police_station ?? "---" },
    { key: "is_pocso", label: "POCSO", render: (r: MlcCase) => r.is_pocso ? <Badge color="danger" size="sm">POCSO</Badge> : null },
    { key: "is_death_case", label: "Death", render: (r: MlcCase) => r.is_death_case ? <Badge color="dark" size="sm">Death</Badge> : null },
    {
      key: "actions", label: "", render: (r: MlcCase) => (
        <Tooltip label="View Details & Documents">
          <ActionIcon variant="light" onClick={() => handleViewCase(r)}>
            <IconFileText size={16} />
          </ActionIcon>
        </Tooltip>
      ),
    },
  ];

  return (
    <Stack mt="md">
      {canCreate && (
        <Group justify="flex-end">
          <Button leftSection={<IconPlus size={16} />} onClick={open}>Register MLC Case</Button>
        </Group>
      )}
      <DataTable columns={columns} data={data} loading={isLoading} rowKey={(r) => r.id} />

      {/* Create MLC Drawer */}
      <Drawer opened={opened} onClose={close} title="Register MLC Case" position="right" size="lg">
        <Stack>
          <PatientSearchSelect value={form.patient_id} onChange={(v) => setForm({ ...form, patient_id: v })} required />
          <Select label="Case Type" data={MLC_CASE_TYPES} value={form.case_type ?? null} onChange={(v) => setForm({ ...form, case_type: v ?? undefined })} />
          <TextInput label="FIR Number" value={form.fir_number ?? ""} onChange={(e) => setForm({ ...form, fir_number: e.currentTarget.value })} />
          <TextInput label="Police Station" value={form.police_station ?? ""} onChange={(e) => setForm({ ...form, police_station: e.currentTarget.value })} />
          <Select label="Brought By" data={[{ value: "police", label: "Police" }, { value: "ambulance", label: "Ambulance" }, { value: "bystander", label: "Bystander" }, { value: "self", label: "Self" }]} value={form.brought_by ?? null} onChange={(v) => setForm({ ...form, brought_by: v ?? undefined })} />
          <TextInput label="Informant Name" value={form.informant_name ?? ""} onChange={(e) => setForm({ ...form, informant_name: e.currentTarget.value })} />
          <TextInput label="Informant Relation" value={form.informant_relation ?? ""} onChange={(e) => setForm({ ...form, informant_relation: e.currentTarget.value })} />
          <TextInput label="Informant Contact" value={form.informant_contact ?? ""} onChange={(e) => setForm({ ...form, informant_contact: e.currentTarget.value })} />
          <Textarea label="History of Incident" value={form.history_of_incident ?? ""} onChange={(e) => setForm({ ...form, history_of_incident: e.currentTarget.value })} minRows={3} />
          <Select label="POCSO Case" data={[{ value: "true", label: "Yes" }, { value: "false", label: "No" }]} value={form.is_pocso ? "true" : "false"} onChange={(v) => setForm({ ...form, is_pocso: v === "true" })} />
          <Select label="Death Case" data={[{ value: "true", label: "Yes" }, { value: "false", label: "No" }]} value={form.is_death_case ? "true" : "false"} onChange={(v) => setForm({ ...form, is_death_case: v === "true" })} />
          <Button onClick={() => mutation.mutate(form)} loading={mutation.isPending}>Register MLC Case</Button>
        </Stack>
      </Drawer>

      {/* MLC Detail Drawer */}
      <Drawer
        opened={detailOpened}
        onClose={() => { closeDetail(); setSelectedCase(null); }}
        title={selectedCase ? `MLC Case: ${selectedCase.mlc_number}` : "MLC Case Details"}
        position="right"
        size="xl"
      >
        {selectedCase && (
          <MlcCaseDetail mlcCase={selectedCase} />
        )}
      </Drawer>
    </Stack>
  );
}

// ── Mass Casualty Tab ──────────────────────────────────

function MassCasualtyTab({ canCreate }: { canCreate: boolean }) {
  const [opened, { open, close }] = useDisclosure(false);
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ["mass-casualty"], queryFn: () => api.listMassCasualtyEvents() });

  const [form, setForm] = useState<CreateMassCasualtyEventRequest>({ event_name: "" });
  const mutation = useMutation({
    mutationFn: (d: CreateMassCasualtyEventRequest) => api.createMassCasualtyEvent(d),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["mass-casualty"] }); close(); notifications.show({ title: "Code Yellow", message: "Mass casualty event activated", color: "danger" }); },
  });

  const mcStatusColor = (s: string) => {
    switch (s) {
      case "activated": return "danger";
      case "ongoing": return "orange";
      case "scaling_down": return "warning";
      case "deactivated": return "success";
      default: return "gray";
    }
  };

  const columns = [
    { key: "event_name", label: "Event", render: (r: MassCasualtyEvent) => <Text fw={600}>{r.event_name}</Text> },
    { key: "event_type", label: "Type", render: (r: MassCasualtyEvent) => r.event_type ?? "---" },
    { key: "status", label: "Status", render: (r: MassCasualtyEvent) => <Badge color={mcStatusColor(r.status)} size="sm">{r.status}</Badge> },
    { key: "activated_at", label: "Activated", render: (r: MassCasualtyEvent) => new Date(r.activated_at).toLocaleString() },
    { key: "estimated_casualties", label: "Est. Casualties", render: (r: MassCasualtyEvent) => r.estimated_casualties ?? "---" },
    { key: "actual_casualties", label: "Actual", render: (r: MassCasualtyEvent) => r.actual_casualties ?? "---" },
    { key: "location", label: "Location", render: (r: MassCasualtyEvent) => r.location ?? "---" },
  ];

  return (
    <Stack mt="md">
      {canCreate && (
        <Group justify="flex-end">
          <Button leftSection={<IconBell size={16} />} color="danger" onClick={open}>Activate Mass Casualty</Button>
        </Group>
      )}
      <DataTable columns={columns} data={data} loading={isLoading} rowKey={(r) => r.id} />

      <Drawer opened={opened} onClose={close} title="Activate Mass Casualty Event" position="right" size="xl">
        <Stack>
          <TextInput label="Event Name" required value={form.event_name} onChange={(e) => setForm({ ...form, event_name: e.currentTarget.value })} />
          <Select label="Event Type" data={MASS_CASUALTY_TYPES} value={form.event_type ?? null} onChange={(v) => setForm({ ...form, event_type: v ?? undefined })} />
          <TextInput label="Location" value={form.location ?? ""} onChange={(e) => setForm({ ...form, location: e.currentTarget.value })} />
          <NumberInput label="Estimated Casualties" value={form.estimated_casualties ?? ""} onChange={(v) => setForm({ ...form, estimated_casualties: typeof v === "number" ? v : undefined })} />
          <Textarea label="Notes" value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.currentTarget.value })} />
          <Button color="danger" onClick={() => mutation.mutate(form)} loading={mutation.isPending}>Activate Mass Casualty</Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}
