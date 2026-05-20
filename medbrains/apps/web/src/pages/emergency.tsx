import { zodResolver } from "@hookform/resolvers/zod";
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
  Textarea,
  TextInput,
  ThemeIcon,
  Title,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  type EmergencyCodeActivationFormInput,
  type ErAdmitFormInput,
  type ErVisitFormInput,
  emergencyCodeActivationFormSchema,
  erAdmitFormSchema,
  erVisitFormSchema,
  type MassCasualtyEventFormInput,
  type MlcAgeEstimationFormInput,
  type MlcCaseFormInput,
  type MlcCourtSummonsFormInput,
  type MlcPocsoReportFormInput,
  type MlcSbarFormInput,
  massCasualtyEventFormSchema,
  mlcAgeEstimationFormSchema,
  mlcCaseFormSchema,
  mlcCourtSummonsFormSchema,
  mlcPocsoReportFormSchema,
  mlcSbarFormSchema,
} from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type {
  AdmitFromErRequest,
  CreateCodeActivationRequest,
  CreateErVisitRequest,
  CreateMassCasualtyEventRequest,
  CreateMlcCaseRequest,
  ErCodeActivation,
  ErVisit,
  MassCasualtyEvent,
  MlcCase,
  MlcDocument,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import {
  IconAlertOctagon,
  IconAlertTriangle,
  IconBell,
  IconBuildingHospital,
  IconCheck,
  IconClock,
  IconFileText,
  IconFirstAidKit,
  IconGavel,
  IconHeartbeat,
  IconPlus,
  IconScale,
  IconShieldCheck,
  IconUrgent,
  IconUsers,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { DataTable, PageHeader } from "../components";
import { BedSelect } from "../components/BedSelect";
import { TriagePanel } from "../components/crdt/TriagePanel";
import { DoctorSearchSelect } from "../components/DoctorSearchSelect";
import { PatientContextBanner } from "../components/Patient/PatientContextBanner";
import { PatientSearchSelect } from "../components/PatientSearchSelect";
import {
  emergencyArrivalModeOptions,
  emergencyCodeTypeOptions,
  emergencyMassCasualtyTypeOptions,
  emergencyMlcBroughtByOptions,
  emergencyMlcCaseTypeOptions,
  emergencyOptionalInteger,
  emergencyOptionalText,
} from "../forms/emergency.form";
import { useRequirePermission } from "../hooks/useRequirePermission";
import { type CreateMlcDocumentInput, emergencyService } from "../services/emergency.service";

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

const emptyErVisitForm: ErVisitFormInput = {
  patient_id: "",
  arrival_mode: "",
  chief_complaint: "",
  bay_number: "",
  is_mlc: false,
  notes: "",
};

const emptyErAdmitForm: ErAdmitFormInput = {
  bed_id: "",
  admitting_doctor_id: "",
  admission_notes: "",
};

const emptyCodeActivationForm: EmergencyCodeActivationFormInput = {
  code_type: "code_blue",
  location: "",
  notes: "",
};

const emptyMlcCaseForm: MlcCaseFormInput = {
  patient_id: "",
  case_type: "",
  fir_number: "",
  police_station: "",
  brought_by: "",
  informant_name: "",
  informant_relation: "",
  informant_contact: "",
  history_of_incident: "",
  is_pocso: false,
  is_death_case: false,
};

const emptyMassCasualtyEventForm: MassCasualtyEventFormInput = {
  event_name: "",
  event_type: "",
  location: "",
  estimated_casualties: "",
  notes: "",
};

// ── Triage helpers ────────────────────────────────────

interface TriageInfo {
  color: string;
  label: string;
  level: number;
}

function triageInfo(level: string | null): TriageInfo {
  switch (level) {
    case "immediate":
      return { color: "danger", label: "RED - Immediate", level: 1 };
    case "emergent":
      return { color: "orange", label: "ORANGE - Emergent", level: 2 };
    case "urgent":
      return { color: "warning", label: "YELLOW - Urgent", level: 3 };
    case "less_urgent":
      return { color: "success", label: "GREEN - Delayed", level: 4 };
    case "non_urgent":
      return { color: "primary", label: "BLUE - Non-Urgent", level: 5 };
    case "expectant":
      return { color: "dark", label: "BLACK - Expectant", level: 6 };
    default:
      return { color: "slate", label: "Unassigned", level: 0 };
  }
}

function statusColor(status: string): string {
  switch (status) {
    case "registered":
      return "primary";
    case "triaged":
      return "cyan";
    case "in_treatment":
      return "orange";
    case "observation":
      return "warning";
    case "admitted":
      return "teal";
    case "discharged":
      return "success";
    case "transferred":
      return "violet";
    case "lama":
      return "danger";
    case "deceased":
      return "dark";
    default:
      return "gray";
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

function WaitTimeBadge({
  arrivalTime,
  doorToDoctorMins,
}: {
  arrivalTime: string;
  doorToDoctorMins: number | null;
}) {
  const display = useTimer(arrivalTime, doorToDoctorMins);

  if (!display)
    return (
      <Text size="sm" c="dimmed">
        --
      </Text>
    );

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
  const { t } = useTranslation("emergency");

  const canCreateVisit = useHasPermission(P.EMERGENCY.VISITS_CREATE);
  const canCreateCode = useHasPermission(P.EMERGENCY.CODES_CREATE);
  const canCreateMlc = useHasPermission(P.EMERGENCY.MLC_CREATE);
  const canCreateMassCasualty = useHasPermission(P.EMERGENCY.MASS_CASUALTY_CREATE);

  const [activeTab, setActiveTab] = useState<string | null>("visits");

  return (
    <div>
      <PageHeader
        title={t("title.emergencyDepartment")}
        subtitle={t("subtitle.erVisits,Triage,MlcManagement,MassCasualty")}
      />
      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="visits" leftSection={<IconUrgent size={16} />}>
            {t("erVisits")}
          </Tabs.Tab>
          <Tabs.Tab value="triage" leftSection={<IconHeartbeat size={16} />}>
            Triage Log
          </Tabs.Tab>
          <Tabs.Tab value="codes" leftSection={<IconHeartbeat size={16} />}>
            {t("codeActivations")}
          </Tabs.Tab>
          <Tabs.Tab value="mlc" leftSection={<IconGavel size={16} />}>
            {t("mlcCases")}
          </Tabs.Tab>
          <Tabs.Tab value="mass-casualty" leftSection={<IconUsers size={16} />}>
            {t("massCasualty")}
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="visits">
          <VisitsTab canCreate={canCreateVisit} />
        </Tabs.Panel>
        <Tabs.Panel value="triage" pt="md">
          <TriageLogTab />
        </Tabs.Panel>
        <Tabs.Panel value="codes">
          <CodesTab canCreate={canCreateCode} />
        </Tabs.Panel>
        <Tabs.Panel value="mlc">
          <MlcTab canCreate={canCreateMlc} />
        </Tabs.Panel>
        <Tabs.Panel value="mass-casualty">
          <MassCasualtyTab canCreate={canCreateMassCasualty} />
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}

// ── Triage Log Tab ──────────────────────────────────────
//
// CRDT-backed triage log: append-only ESI entries that survive a
// WAN outage. Picks a visit from the live ER queue; the panel
// below switches REST↔CRDT based on TenantConfigProvider.

function TriageLogTab() {
  const [visitId, setVisitId] = useState<string | null>(null);
  const { data: visits = [] } = useQuery({
    queryKey: ["er-visits"],
    queryFn: () => emergencyService.listErVisits(),
  });

  const options = (visits as ErVisit[]).map((v) => ({
    value: v.id,
    label: `${v.visit_number} — ${v.chief_complaint ?? "No complaint"}`,
  }));

  return (
    <Stack>
      <Select
        placeholder="Select an ER visit…"
        data={options}
        value={visitId}
        onChange={setVisitId}
        searchable
        clearable
        maxDropdownHeight={300}
      />
      {visitId ? (
        <TriagePanel visitId={visitId} />
      ) : (
        <Text size="sm" c="dimmed">
          Pick a visit to record or review triage entries.
        </Text>
      )}
    </Stack>
  );
}

// ── ER Visits Tab ──────────────────────────────────────

function VisitsTab({ canCreate }: { canCreate: boolean }) {
  const [opened, { open, close }] = useDisclosure(false);
  const [admitOpen, admitHandlers] = useDisclosure(false);
  const [admitVisitId, setAdmitVisitId] = useState<string | null>(null);
  const canAdmit = useHasPermission(P.EMERGENCY.VISITS_UPDATE);
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ["er-visits"],
    queryFn: () => emergencyService.listErVisits(),
  });

  const {
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<ErVisitFormInput>({
    resolver: zodResolver(erVisitFormSchema),
    defaultValues: emptyErVisitForm,
  });
  const selectedPatientId = watch("patient_id");
  const mutation = useMutation({
    mutationFn: (d: CreateErVisitRequest) => emergencyService.createErVisit(d),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["er-visits"] });
      close();
      notifications.show({ title: "Success", message: "ER visit registered" });
    },
  });

  // Admit from ER
  const {
    control: admitControl,
    handleSubmit: handleAdmitSubmit,
    reset: resetAdmit,
    formState: { errors: admitErrors },
  } = useForm<ErAdmitFormInput>({
    resolver: zodResolver(erAdmitFormSchema),
    defaultValues: emptyErAdmitForm,
  });
  const admitMutation = useMutation({
    mutationFn: ({ visitId, data: d }: { visitId: string; data: AdmitFromErRequest }) =>
      emergencyService.admitFromEr(visitId, d),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["er-visits"] });
      notifications.show({
        title: "Patient Admitted",
        message: "Patient has been admitted to IPD from ER",
        color: "success",
      });
      resetAdmit(emptyErAdmitForm);
      setAdmitVisitId(null);
      admitHandlers.close();
    },
  });

  const handleOpenAdmit = (visitId: string) => {
    setAdmitVisitId(visitId);
    resetAdmit(emptyErAdmitForm);
    admitHandlers.open();
  };

  const submitErVisit = (values: ErVisitFormInput) => {
    mutation.mutate({
      patient_id: values.patient_id,
      arrival_mode: values.arrival_mode || undefined,
      chief_complaint: emergencyOptionalText(values.chief_complaint),
      is_mlc: values.is_mlc,
      bay_number: emergencyOptionalText(values.bay_number),
      notes: emergencyOptionalText(values.notes),
    });
  };

  const submitAdmitFromEr = (values: ErAdmitFormInput) => {
    if (!admitVisitId) return;
    admitMutation.mutate({
      visitId: admitVisitId,
      data: {
        bed_id: values.bed_id,
        admitting_doctor_id: values.admitting_doctor_id,
        admission_notes: emergencyOptionalText(values.admission_notes),
      },
    });
  };

  const columns = [
    {
      key: "visit_number",
      label: "Visit #",
      render: (r: ErVisit) => <Text fw={600}>{r.visit_number}</Text>,
    },
    {
      key: "arrival_time",
      label: "Arrival",
      render: (r: ErVisit) => new Date(r.arrival_time).toLocaleString(),
    },
    { key: "arrival_mode", label: "Mode", render: (r: ErVisit) => r.arrival_mode ?? "---" },
    {
      key: "chief_complaint",
      label: "Chief Complaint",
      render: (r: ErVisit) => r.chief_complaint ?? "---",
    },
    {
      key: "triage_level",
      label: "Triage",
      render: (r: ErVisit) => {
        const info = triageInfo(r.triage_level);
        if (!r.triage_level) {
          return (
            <Badge color="slate" size="lg" variant="outline">
              Unassigned
            </Badge>
          );
        }
        return (
          <Badge
            color={info.color}
            size="lg"
            variant="filled"
            leftSection={
              <ThemeIcon color={info.color} size="xs" radius="xl" variant="white">
                <Text size="xs" fw={900}>
                  {info.level}
                </Text>
              </ThemeIcon>
            }
          >
            {info.label}
          </Badge>
        );
      },
    },
    {
      key: "status",
      label: "Status",
      render: (r: ErVisit) => (
        <Badge color={statusColor(r.status)} size="sm">
          {r.status}
        </Badge>
      ),
    },
    {
      key: "is_mlc",
      label: "MLC",
      render: (r: ErVisit) =>
        r.is_mlc ? (
          <Badge color="danger" size="sm">
            MLC
          </Badge>
        ) : null,
    },
    { key: "bay_number", label: "Bay", render: (r: ErVisit) => r.bay_number ?? "---" },
    {
      key: "wait_time",
      label: "Wait Time",
      render: (r: ErVisit) => (
        <WaitTimeBadge arrivalTime={r.arrival_time} doorToDoctorMins={r.door_to_doctor_mins} />
      ),
    },
    {
      key: "actions",
      label: "",
      render: (r: ErVisit) => {
        const canShowAdmit =
          canAdmit && ["registered", "triaged", "in_treatment", "observation"].includes(r.status);
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
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => {
              reset(emptyErVisitForm);
              open();
            }}
          >
            Register ER Visit
          </Button>
        </Group>
      )}
      <DataTable columns={columns} data={data} loading={isLoading} rowKey={(r) => r.id} />

      <Drawer opened={opened} onClose={close} title="Register ER Visit" position="right" size="xl">
        <Stack component="form" onSubmit={handleSubmit(submitErVisit)}>
          <Controller
            name="patient_id"
            control={control}
            render={({ field }) => (
              <PatientSearchSelect value={field.value} onChange={field.onChange} required />
            )}
          />
          {errors.patient_id?.message && (
            <Text size="xs" c="danger">
              {errors.patient_id.message}
            </Text>
          )}
          <PatientContextBanner patientId={selectedPatientId} hideLoadingState />
          <Controller
            name="arrival_mode"
            control={control}
            render={({ field }) => (
              <Select
                label="Arrival Mode"
                data={emergencyArrivalModeOptions}
                value={field.value || null}
                onChange={(value) => field.onChange(value ?? "")}
                clearable
                error={errors.arrival_mode?.message}
              />
            )}
          />
          <Controller
            name="chief_complaint"
            control={control}
            render={({ field }) => <TextInput label="Chief Complaint" {...field} />}
          />
          <Controller
            name="bay_number"
            control={control}
            render={({ field }) => <TextInput label="Bay Number" {...field} />}
          />
          <Controller
            name="is_mlc"
            control={control}
            render={({ field }) => (
              <Select
                label="MLC"
                data={[
                  { value: "true", label: "Yes" },
                  { value: "false", label: "No" },
                ]}
                value={field.value ? "true" : "false"}
                onChange={(value) => field.onChange(value === "true")}
              />
            )}
          />
          <Controller
            name="notes"
            control={control}
            render={({ field }) => <Textarea label="Notes" {...field} />}
          />
          <Button type="submit" loading={mutation.isPending}>
            Register
          </Button>
        </Stack>
      </Drawer>

      {/* Admit to IPD Modal */}
      <Modal
        opened={admitOpen}
        onClose={() => {
          admitHandlers.close();
          setAdmitVisitId(null);
          resetAdmit(emptyErAdmitForm);
        }}
        title="Admit Patient to IPD"
        size="md"
      >
        <Stack component="form" onSubmit={handleAdmitSubmit(submitAdmitFromEr)}>
          <Controller
            name="bed_id"
            control={admitControl}
            render={({ field }) => (
              <BedSelect value={field.value} onChange={field.onChange} required />
            )}
          />
          {admitErrors.bed_id?.message && (
            <Text size="xs" c="danger">
              {admitErrors.bed_id.message}
            </Text>
          )}
          <Controller
            name="admitting_doctor_id"
            control={admitControl}
            render={({ field }) => (
              <DoctorSearchSelect
                label="Admitting Doctor"
                value={field.value}
                onChange={field.onChange}
                required
              />
            )}
          />
          {admitErrors.admitting_doctor_id?.message && (
            <Text size="xs" c="danger">
              {admitErrors.admitting_doctor_id.message}
            </Text>
          )}
          <Controller
            name="admission_notes"
            control={admitControl}
            render={({ field }) => (
              <Textarea
                label="Admission Notes"
                {...field}
                placeholder="Reason for admission, clinical notes..."
                minRows={3}
              />
            )}
          />
          <Button
            type="submit"
            color="teal"
            leftSection={<IconBuildingHospital size={16} />}
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
  const { data = [], isLoading } = useQuery({
    queryKey: ["er-codes"],
    queryFn: () => emergencyService.listCodeActivations(),
  });

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EmergencyCodeActivationFormInput>({
    resolver: zodResolver(emergencyCodeActivationFormSchema),
    defaultValues: emptyCodeActivationForm,
  });
  const [crashCart, setCrashCart] = useState<Record<string, boolean>>({});

  const createMut = useMutation({
    mutationFn: (d: CreateCodeActivationRequest) => emergencyService.createCodeActivation(d),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({ queryKey: ["er-codes"] });
      close();
      setCrashCart({});
      notifications.show({
        title: "Code Activated",
        message: `${variables.code_type.toUpperCase()} activated`,
        color: "danger",
      });
    },
  });

  const deactivateMut = useMutation({
    mutationFn: (id: string) => emergencyService.deactivateCode(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["er-codes"] });
      notifications.show({ title: "Code Deactivated", message: "Code has been deactivated" });
    },
  });

  const handleCreate = (values: EmergencyCodeActivationFormInput) => {
    const hasCheckedItems = Object.values(crashCart).some((v) => v);
    const payload: CreateCodeActivationRequest = {
      code_type: values.code_type,
      location: emergencyOptionalText(values.location),
      notes: emergencyOptionalText(values.notes),
      crash_cart_checklist: hasCheckedItems ? crashCart : undefined,
    };
    createMut.mutate(payload);
  };

  const handleViewDetail = (code: ErCodeActivation) => {
    setSelectedCode(code);
    openDetail();
  };

  const columns = [
    {
      key: "code_type",
      label: "Code",
      render: (r: ErCodeActivation) => (
        <Badge
          color={
            r.code_type === "blue" ? "primary" : r.code_type === "yellow" ? "warning" : "orange"
          }
          size="lg"
        >
          CODE {r.code_type.toUpperCase()}
        </Badge>
      ),
    },
    {
      key: "activated_at",
      label: "Activated",
      render: (r: ErCodeActivation) => new Date(r.activated_at).toLocaleString(),
    },
    { key: "location", label: "Location", render: (r: ErCodeActivation) => r.location ?? "---" },
    { key: "outcome", label: "Outcome", render: (r: ErCodeActivation) => r.outcome ?? "---" },
    {
      key: "deactivated_at",
      label: "Status",
      render: (r: ErCodeActivation) =>
        r.deactivated_at ? (
          <Badge color="success" size="sm">
            Resolved
          </Badge>
        ) : (
          <Badge color="danger" size="sm">
            Active
          </Badge>
        ),
    },
    {
      key: "crash_cart",
      label: "Crash Cart",
      render: (r: ErCodeActivation) => {
        const checklist = r.crash_cart_checklist as Record<string, boolean> | null;
        if (!checklist)
          return (
            <Text size="sm" c="dimmed">
              Not checked
            </Text>
          );
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
      key: "actions",
      label: "",
      render: (r: ErCodeActivation) => (
        <Group gap="xs">
          <Tooltip label="View Details">
            <ActionIcon variant="light" onClick={() => handleViewDetail(r)}>
              <IconFileText size={16} />
            </ActionIcon>
          </Tooltip>
          {!r.deactivated_at && canCreate && (
            <Tooltip label="Deactivate">
              <ActionIcon
                color="success"
                variant="light"
                onClick={() => deactivateMut.mutate(r.id)}
              >
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
          <Button
            leftSection={<IconAlertTriangle size={16} />}
            color="danger"
            onClick={() => {
              reset(emptyCodeActivationForm);
              open();
            }}
          >
            Activate Code
          </Button>
        </Group>
      )}
      <DataTable columns={columns} data={data} loading={isLoading} rowKey={(r) => r.id} />

      {/* Create Code Drawer */}
      <Drawer
        opened={opened}
        onClose={() => {
          close();
          setCrashCart({});
          reset(emptyCodeActivationForm);
        }}
        title="Activate Emergency Code"
        position="right"
        size="lg"
      >
        <Stack component="form" onSubmit={handleSubmit(handleCreate)}>
          <Controller
            name="code_type"
            control={control}
            render={({ field }) => (
              <Select
                label="Code Type"
                required
                data={emergencyCodeTypeOptions}
                value={field.value}
                onChange={(value) => field.onChange(value ?? "code_blue")}
                error={errors.code_type?.message}
              />
            )}
          />
          <Controller
            name="location"
            control={control}
            render={({ field }) => <TextInput label="Location" {...field} />}
          />
          <Controller
            name="notes"
            control={control}
            render={({ field }) => <Textarea label="Notes" {...field} />}
          />
          <Divider />
          <CrashCartChecklist value={crashCart} onChange={setCrashCart} />
          <Button color="danger" type="submit" loading={createMut.isPending}>
            Activate Code
          </Button>
        </Stack>
      </Drawer>

      {/* Code Detail Drawer */}
      <Drawer
        opened={detailOpened}
        onClose={closeDetail}
        title="Code Activation Details"
        position="right"
        size="lg"
      >
        {selectedCode && (
          <Stack>
            <Group>
              <Badge color={selectedCode.code_type === "blue" ? "primary" : "orange"} size="xl">
                CODE {selectedCode.code_type.toUpperCase()}
              </Badge>
              {selectedCode.deactivated_at ? (
                <Badge color="success" size="lg">
                  Resolved
                </Badge>
              ) : (
                <Badge color="danger" size="lg">
                  Active
                </Badge>
              )}
            </Group>
            <Text size="sm">
              <Text span fw={600}>
                Activated:
              </Text>{" "}
              {new Date(selectedCode.activated_at).toLocaleString()}
            </Text>
            {selectedCode.deactivated_at && (
              <Text size="sm">
                <Text span fw={600}>
                  Deactivated:
                </Text>{" "}
                {new Date(selectedCode.deactivated_at).toLocaleString()}
              </Text>
            )}
            {selectedCode.location && (
              <Text size="sm">
                <Text span fw={600}>
                  Location:
                </Text>{" "}
                {selectedCode.location}
              </Text>
            )}
            {selectedCode.outcome && (
              <Text size="sm">
                <Text span fw={600}>
                  Outcome:
                </Text>{" "}
                {selectedCode.outcome}
              </Text>
            )}
            {selectedCode.notes && (
              <Text size="sm">
                <Text span fw={600}>
                  Notes:
                </Text>{" "}
                {selectedCode.notes}
              </Text>
            )}

            <Divider />
            <Title order={5}>Crash Cart Checklist</Title>
            {selectedChecklist ? (
              <Card withBorder p="md">
                <Stack gap="xs">
                  {CRASH_CART_ITEMS.map((item) => (
                    <Group key={item.key} gap="xs">
                      {selectedChecklist[item.key] ? (
                        <ThemeIcon color="success" size="sm" radius="xl">
                          <IconCheck size={12} />
                        </ThemeIcon>
                      ) : (
                        <ThemeIcon color="danger" size="sm" radius="xl" variant="light">
                          <IconAlertTriangle size={12} />
                        </ThemeIcon>
                      )}
                      <Text size="sm" c={selectedChecklist[item.key] ? undefined : "danger"}>
                        {item.label}
                      </Text>
                    </Group>
                  ))}
                </Stack>
              </Card>
            ) : (
              <Text size="sm" c="dimmed">
                No crash cart checklist was recorded for this activation.
              </Text>
            )}
          </Stack>
        )}
      </Drawer>
    </Stack>
  );
}

// ── MLC Cases Tab ──────────────────────────────────────

const EMPTY_SBAR: MlcSbarFormInput = {
  situation: "",
  background: "",
  assessment: "",
  recommendation: "",
};
const EMPTY_AGE_EST: MlcAgeEstimationFormInput = {
  ossification_center_findings: "",
  dental_examination: "",
  secondary_sexual_characteristics: "",
  estimated_age_range: "",
  examiner_opinion: "",
};
const EMPTY_POCSO: MlcPocsoReportFormInput = {
  child_age: "",
  guardian_details: "",
  statement_summary: "",
  injuries_documented: "",
  psych_assessment_needed: false,
};
const EMPTY_SUMMONS: MlcCourtSummonsFormInput = {
  date: "",
  court_name: "",
  case_number: "",
  status: "pending",
  notes: "",
};

function MlcCaseDetail({ mlcCase }: { mlcCase: MlcCase }) {
  const qc = useQueryClient();

  // Sub-drawer state
  const [sbarOpened, { open: openSbar, close: closeSbar }] = useDisclosure(false);
  const [ageEstOpened, { open: openAgeEst, close: closeAgeEst }] = useDisclosure(false);
  const [pocsoOpened, { open: openPocso, close: closePocso }] = useDisclosure(false);
  const [summonsOpened, { open: openSummons, close: closeSummons }] = useDisclosure(false);

  const {
    formState: { errors: sbarErrors },
    handleSubmit: handleSbarSubmit,
    register: registerSbar,
    reset: resetSbar,
  } = useForm<MlcSbarFormInput>({
    resolver: zodResolver(mlcSbarFormSchema),
    defaultValues: EMPTY_SBAR,
  });
  const {
    formState: { errors: ageEstErrors },
    handleSubmit: handleAgeEstSubmit,
    register: registerAgeEst,
    reset: resetAgeEst,
  } = useForm<MlcAgeEstimationFormInput>({
    resolver: zodResolver(mlcAgeEstimationFormSchema),
    defaultValues: EMPTY_AGE_EST,
  });
  const {
    control: pocsoControl,
    formState: { errors: pocsoErrors },
    handleSubmit: handlePocsoSubmit,
    register: registerPocso,
    reset: resetPocso,
  } = useForm<MlcPocsoReportFormInput>({
    resolver: zodResolver(mlcPocsoReportFormSchema),
    defaultValues: EMPTY_POCSO,
  });
  const {
    control: summonsControl,
    formState: { errors: summonsErrors },
    handleSubmit: handleSummonsSubmit,
    register: registerSummons,
    reset: resetSummons,
  } = useForm<MlcCourtSummonsFormInput>({
    resolver: zodResolver(mlcCourtSummonsFormSchema),
    defaultValues: EMPTY_SUMMONS,
  });

  // Fetch documents for this MLC case
  const { data: documents = [] } = useQuery({
    queryKey: ["mlc-documents", mlcCase.id],
    queryFn: () => emergencyService.listMlcDocuments(mlcCase.id),
  });

  const createDocMut = useMutation({
    mutationFn: (data: CreateMlcDocumentInput) =>
      emergencyService.createMlcDocument(mlcCase.id, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["mlc-documents", mlcCase.id] });
      notifications.show({ title: "Document Created", message: "MLC document saved successfully" });
    },
  });

  const submitSbar = handleSbarSubmit((values) => {
    createDocMut.mutate({
      document_type: "sbar_handover",
      title: `SBAR Handover - ${mlcCase.mlc_number}`,
      content: values,
    });
    closeSbar();
    resetSbar(EMPTY_SBAR);
  });

  const submitAgeEst = handleAgeEstSubmit((values) => {
    createDocMut.mutate({
      document_type: "age_estimation",
      title: `Age Estimation - ${mlcCase.mlc_number}`,
      content: values,
    });
    closeAgeEst();
    resetAgeEst(EMPTY_AGE_EST);
  });

  const submitPocso = handlePocsoSubmit((values) => {
    createDocMut.mutate({
      document_type: "pocso_report",
      title: `POCSO Report - ${mlcCase.mlc_number}`,
      content: values,
    });
    closePocso();
    resetPocso(EMPTY_POCSO);
  });

  const submitSummons = handleSummonsSubmit((values) => {
    createDocMut.mutate({
      document_type: "court_summons",
      title: `Court Summons - ${values.court_name}`,
      content: values,
    });
    closeSummons();
    resetSummons(EMPTY_SUMMONS);
  });

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
            This is a POCSO (Protection of Children from Sexual Offences) case. All documentation
            must comply with POCSO Act, 2012. Ensure child-friendly procedures and mandatory
            reporting to police/SJPU within 24 hours.
          </Alert>
        )}

        {/* Case Info */}
        <Card withBorder p="md">
          <Group justify="space-between" mb="xs">
            <Title order={5}>{mlcCase.mlc_number}</Title>
            <Group gap="xs">
              {mlcCase.is_pocso && (
                <Badge color="danger" size="lg">
                  POCSO
                </Badge>
              )}
              {mlcCase.is_death_case && (
                <Badge color="dark" size="lg">
                  Death Case
                </Badge>
              )}
              <Badge color={mlcCase.status === "closed" ? "success" : "orange"} size="lg">
                {mlcCase.status}
              </Badge>
            </Group>
          </Group>
          <Text size="sm">
            <Text span fw={600}>
              Type:
            </Text>{" "}
            {mlcCase.case_type ?? "---"}
          </Text>
          <Text size="sm">
            <Text span fw={600}>
              Registered:
            </Text>{" "}
            {new Date(mlcCase.registered_at).toLocaleString()}
          </Text>
          {mlcCase.fir_number && (
            <Text size="sm">
              <Text span fw={600}>
                FIR #:
              </Text>{" "}
              {mlcCase.fir_number}
            </Text>
          )}
          {mlcCase.police_station && (
            <Text size="sm">
              <Text span fw={600}>
                Police Station:
              </Text>{" "}
              {mlcCase.police_station}
            </Text>
          )}
          {mlcCase.history_of_incident && (
            <Text size="sm">
              <Text span fw={600}>
                History:
              </Text>{" "}
              {mlcCase.history_of_incident}
            </Text>
          )}
        </Card>

        {/* Action Buttons */}
        <Group>
          <Button leftSection={<IconShieldCheck size={16} />} variant="light" onClick={openSbar}>
            SBAR Handover
          </Button>
          <Button
            leftSection={<IconScale size={16} />}
            variant="light"
            color="violet"
            onClick={openAgeEst}
          >
            Age Estimation
          </Button>
          {mlcCase.is_pocso && (
            <Button
              leftSection={<IconAlertOctagon size={16} />}
              variant="light"
              color="danger"
              onClick={openPocso}
            >
              POCSO Report
            </Button>
          )}
          <Button
            leftSection={<IconGavel size={16} />}
            variant="light"
            color="warning"
            onClick={openSummons}
          >
            Add Court Summons
          </Button>
        </Group>

        <Divider />

        {/* SBAR Handover Documents */}
        {sbarDocs.length > 0 && (
          <Box>
            <Title order={6} mb="xs">
              SBAR Handover Records
            </Title>
            <Stack gap="xs">
              {sbarDocs.map((doc) => {
                const c = doc.content as Record<string, string>;
                return (
                  <Card key={doc.id} withBorder p="sm">
                    <Text size="xs" c="dimmed" mb="xs">
                      {new Date(doc.created_at).toLocaleString()}
                    </Text>
                    <Text size="sm">
                      <Text span fw={600}>
                        S:
                      </Text>{" "}
                      {c.situation || "---"}
                    </Text>
                    <Text size="sm">
                      <Text span fw={600}>
                        B:
                      </Text>{" "}
                      {c.background || "---"}
                    </Text>
                    <Text size="sm">
                      <Text span fw={600}>
                        A:
                      </Text>{" "}
                      {c.assessment || "---"}
                    </Text>
                    <Text size="sm">
                      <Text span fw={600}>
                        R:
                      </Text>{" "}
                      {c.recommendation || "---"}
                    </Text>
                  </Card>
                );
              })}
            </Stack>
          </Box>
        )}

        {/* Age Estimation Documents */}
        {ageEstDocs.length > 0 && (
          <Box>
            <Title order={6} mb="xs">
              Age Estimation Reports
            </Title>
            <Stack gap="xs">
              {ageEstDocs.map((doc) => {
                const c = doc.content as Record<string, string>;
                return (
                  <Card key={doc.id} withBorder p="sm">
                    <Text size="xs" c="dimmed" mb="xs">
                      {new Date(doc.created_at).toLocaleString()}
                    </Text>
                    <Text size="sm">
                      <Text span fw={600}>
                        Ossification:
                      </Text>{" "}
                      {c.ossification_center_findings || "---"}
                    </Text>
                    <Text size="sm">
                      <Text span fw={600}>
                        Dental:
                      </Text>{" "}
                      {c.dental_examination || "---"}
                    </Text>
                    <Text size="sm">
                      <Text span fw={600}>
                        Secondary Sexual:
                      </Text>{" "}
                      {c.secondary_sexual_characteristics || "---"}
                    </Text>
                    <Text size="sm">
                      <Text span fw={600}>
                        Estimated Range:
                      </Text>{" "}
                      {c.estimated_age_range || "---"}
                    </Text>
                    <Text size="sm">
                      <Text span fw={600}>
                        Opinion:
                      </Text>{" "}
                      {c.examiner_opinion || "---"}
                    </Text>
                  </Card>
                );
              })}
            </Stack>
          </Box>
        )}

        {/* POCSO Reports */}
        {pocsoDocs.length > 0 && (
          <Box>
            <Title order={6} mb="xs">
              POCSO Reports
            </Title>
            <Stack gap="xs">
              {pocsoDocs.map((doc) => {
                const c = doc.content as Record<string, unknown>;
                return (
                  <Card key={doc.id} withBorder p="sm">
                    <Text size="xs" c="dimmed" mb="xs">
                      {new Date(doc.created_at).toLocaleString()}
                    </Text>
                    <Text size="sm">
                      <Text span fw={600}>
                        Child Age:
                      </Text>{" "}
                      {String(c.child_age || "---")}
                    </Text>
                    <Text size="sm">
                      <Text span fw={600}>
                        Guardian:
                      </Text>{" "}
                      {String(c.guardian_details || "---")}
                    </Text>
                    <Text size="sm">
                      <Text span fw={600}>
                        Statement:
                      </Text>{" "}
                      {String(c.statement_summary || "---")}
                    </Text>
                    <Text size="sm">
                      <Text span fw={600}>
                        Injuries:
                      </Text>{" "}
                      {String(c.injuries_documented || "---")}
                    </Text>
                    <Text size="sm">
                      <Text span fw={600}>
                        Psych Assessment Needed:
                      </Text>{" "}
                      {c.psych_assessment_needed ? "Yes" : "No"}
                    </Text>
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
                      const color =
                        s === "attended"
                          ? "success"
                          : s === "adjourned"
                            ? "warning"
                            : s === "pending"
                              ? "primary"
                              : "slate";
                      return (
                        <Badge color={color} size="sm">
                          {s}
                        </Badge>
                      );
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
            <Text size="sm" c="dimmed">
              No court summons recorded.
            </Text>
          )}
        </Box>
      </Stack>

      {/* SBAR Handover Drawer */}
      <Drawer
        opened={sbarOpened}
        onClose={() => {
          closeSbar();
          resetSbar(EMPTY_SBAR);
        }}
        title="SBAR Handover"
        position="right"
        size="lg"
      >
        <Stack component="form" onSubmit={submitSbar}>
          <Alert color="primary" variant="light" icon={<IconShieldCheck size={16} />}>
            SBAR (Situation-Background-Assessment-Recommendation) is a standardized communication
            tool for clinical handovers as recommended by WHO and NABH.
          </Alert>
          <Textarea
            label="Situation"
            description="Concise statement of the problem: who is the patient, what is the current concern?"
            error={sbarErrors.situation?.message}
            {...registerSbar("situation")}
            minRows={3}
            required
          />
          <Textarea
            label="Background"
            description="Pertinent history, context: relevant medical history, current medications, allergies, lab results"
            error={sbarErrors.background?.message}
            {...registerSbar("background")}
            minRows={3}
            required
          />
          <Textarea
            label="Assessment"
            description="Your clinical assessment: what you think the problem is"
            error={sbarErrors.assessment?.message}
            {...registerSbar("assessment")}
            minRows={3}
            required
          />
          <Textarea
            label="Recommendation"
            description="What you need: specific request, action needed, timeline"
            error={sbarErrors.recommendation?.message}
            {...registerSbar("recommendation")}
            minRows={3}
            required
          />
          <Button type="submit" loading={createDocMut.isPending}>
            Save SBAR Handover
          </Button>
        </Stack>
      </Drawer>

      {/* Age Estimation Drawer */}
      <Drawer
        opened={ageEstOpened}
        onClose={() => {
          closeAgeEst();
          resetAgeEst(EMPTY_AGE_EST);
        }}
        title="Age Estimation Documentation"
        position="right"
        size="lg"
      >
        <Stack component="form" onSubmit={submitAgeEst}>
          <Alert color="violet" variant="light" icon={<IconScale size={16} />}>
            Age estimation is a medico-legal procedure. Document all findings carefully. Ensure the
            examination is conducted by an authorized medical officer.
          </Alert>
          <Textarea
            label="Ossification Center Findings"
            description="X-ray findings of wrist, elbow, pelvis, and other ossification centers"
            error={ageEstErrors.ossification_center_findings?.message}
            {...registerAgeEst("ossification_center_findings")}
            minRows={3}
            required
          />
          <Textarea
            label="Dental Examination"
            description="Eruption of teeth, third molar status, dental age assessment"
            error={ageEstErrors.dental_examination?.message}
            {...registerAgeEst("dental_examination")}
            minRows={3}
            required
          />
          <Textarea
            label="Secondary Sexual Characteristics"
            description="Development stage as per Tanner staging"
            error={ageEstErrors.secondary_sexual_characteristics?.message}
            {...registerAgeEst("secondary_sexual_characteristics")}
            minRows={3}
            required
          />
          <TextInput
            label="Estimated Age Range"
            description="e.g., 16-18 years"
            error={ageEstErrors.estimated_age_range?.message}
            {...registerAgeEst("estimated_age_range")}
            required
          />
          <Textarea
            label="Examiner Opinion"
            description="Final opinion on probable age with reasoning"
            error={ageEstErrors.examiner_opinion?.message}
            {...registerAgeEst("examiner_opinion")}
            minRows={3}
            required
          />
          <Button color="violet" type="submit" loading={createDocMut.isPending}>
            Save Age Estimation
          </Button>
        </Stack>
      </Drawer>

      {/* POCSO Report Drawer */}
      <Drawer
        opened={pocsoOpened}
        onClose={() => {
          closePocso();
          resetPocso(EMPTY_POCSO);
        }}
        title="POCSO Report"
        position="right"
        size="lg"
      >
        <Stack component="form" onSubmit={submitPocso}>
          <Alert color="danger" variant="filled" icon={<IconAlertOctagon size={16} />}>
            POCSO Act, 2012 mandates mandatory reporting. This report is a legal document. Ensure
            child-friendly language and procedures throughout.
          </Alert>
          <TextInput
            label="Child Age"
            description="Age of the child victim"
            error={pocsoErrors.child_age?.message}
            {...registerPocso("child_age")}
            required
          />
          <Textarea
            label="Guardian Details"
            description="Name, relation, contact of guardian/parent accompanying the child"
            error={pocsoErrors.guardian_details?.message}
            {...registerPocso("guardian_details")}
            minRows={2}
            required
          />
          <Textarea
            label="Statement Summary"
            description="Summary of statement in the child's own words (do not lead or suggest)"
            error={pocsoErrors.statement_summary?.message}
            {...registerPocso("statement_summary")}
            minRows={4}
            required
          />
          <Textarea
            label="Injuries Documented"
            description="Clinical findings: injuries, marks, physical examination findings"
            error={pocsoErrors.injuries_documented?.message}
            {...registerPocso("injuries_documented")}
            minRows={3}
            required
          />
          <Controller
            name="psych_assessment_needed"
            control={pocsoControl}
            render={({ field }) => (
              <Checkbox
                label="Psychological assessment needed"
                checked={field.value}
                onChange={(event) => field.onChange(event.currentTarget.checked)}
              />
            )}
          />
          <Button color="danger" type="submit" loading={createDocMut.isPending}>
            Save POCSO Report
          </Button>
        </Stack>
      </Drawer>

      {/* Court Summons Drawer */}
      <Drawer
        opened={summonsOpened}
        onClose={() => {
          closeSummons();
          resetSummons(EMPTY_SUMMONS);
        }}
        title="Add Court Summons"
        position="right"
        size="md"
      >
        <Stack component="form" onSubmit={submitSummons}>
          <TextInput
            label="Date"
            type="date"
            error={summonsErrors.date?.message}
            {...registerSummons("date")}
            required
          />
          <TextInput
            label="Court Name"
            error={summonsErrors.court_name?.message}
            {...registerSummons("court_name")}
            required
          />
          <TextInput
            label="Case Number"
            error={summonsErrors.case_number?.message}
            {...registerSummons("case_number")}
            required
          />
          <Controller
            name="status"
            control={summonsControl}
            render={({ field }) => (
              <Select
                label="Status"
                data={[
                  { value: "pending", label: "Pending" },
                  { value: "attended", label: "Attended" },
                  { value: "adjourned", label: "Adjourned" },
                  { value: "cancelled", label: "Cancelled" },
                ]}
                value={field.value}
                onChange={field.onChange}
                error={summonsErrors.status?.message}
              />
            )}
          />
          <Textarea
            label="Notes"
            error={summonsErrors.notes?.message}
            {...registerSummons("notes")}
          />
          <Button color="warning" type="submit" loading={createDocMut.isPending}>
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
  const { data = [], isLoading } = useQuery({
    queryKey: ["mlc-cases"],
    queryFn: () => emergencyService.listMlcCases(),
  });

  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<MlcCaseFormInput>({
    resolver: zodResolver(mlcCaseFormSchema),
    defaultValues: emptyMlcCaseForm,
  });
  const selectedPatientId = watch("patient_id");
  const mutation = useMutation({
    mutationFn: (d: CreateMlcCaseRequest) => emergencyService.createMlcCase(d),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["mlc-cases"] });
      close();
      notifications.show({ title: "Success", message: "MLC case registered" });
    },
  });

  const mlcStatusColor = (s: string) => {
    switch (s) {
      case "registered":
        return "primary";
      case "under_investigation":
        return "orange";
      case "opinion_given":
        return "teal";
      case "court_pending":
        return "warning";
      case "closed":
        return "success";
      default:
        return "gray";
    }
  };

  const handleViewCase = (mlc: MlcCase) => {
    setSelectedCase(mlc);
    openDetail();
  };

  const submitMlcCase = (values: MlcCaseFormInput) => {
    mutation.mutate({
      patient_id: values.patient_id,
      case_type: values.case_type || undefined,
      fir_number: emergencyOptionalText(values.fir_number),
      police_station: emergencyOptionalText(values.police_station),
      brought_by: values.brought_by || undefined,
      informant_name: emergencyOptionalText(values.informant_name),
      informant_relation: emergencyOptionalText(values.informant_relation),
      informant_contact: emergencyOptionalText(values.informant_contact),
      history_of_incident: emergencyOptionalText(values.history_of_incident),
      is_pocso: values.is_pocso,
      is_death_case: values.is_death_case,
    });
  };

  const columns = [
    {
      key: "mlc_number",
      label: "MLC #",
      render: (r: MlcCase) => <Text fw={600}>{r.mlc_number}</Text>,
    },
    {
      key: "registered_at",
      label: "Registered",
      render: (r: MlcCase) => new Date(r.registered_at).toLocaleString(),
    },
    { key: "case_type", label: "Type", render: (r: MlcCase) => r.case_type ?? "---" },
    {
      key: "status",
      label: "Status",
      render: (r: MlcCase) => (
        <Badge color={mlcStatusColor(r.status)} size="sm">
          {r.status}
        </Badge>
      ),
    },
    { key: "fir_number", label: "FIR #", render: (r: MlcCase) => r.fir_number ?? "---" },
    {
      key: "police_station",
      label: "Police Station",
      render: (r: MlcCase) => r.police_station ?? "---",
    },
    {
      key: "is_pocso",
      label: "POCSO",
      render: (r: MlcCase) =>
        r.is_pocso ? (
          <Badge color="danger" size="sm">
            POCSO
          </Badge>
        ) : null,
    },
    {
      key: "is_death_case",
      label: "Death",
      render: (r: MlcCase) =>
        r.is_death_case ? (
          <Badge color="dark" size="sm">
            Death
          </Badge>
        ) : null,
    },
    {
      key: "actions",
      label: "",
      render: (r: MlcCase) => (
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
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => {
              reset(emptyMlcCaseForm);
              open();
            }}
          >
            Register MLC Case
          </Button>
        </Group>
      )}
      <DataTable columns={columns} data={data} loading={isLoading} rowKey={(r) => r.id} />

      {/* Create MLC Drawer */}
      <Drawer opened={opened} onClose={close} title="Register MLC Case" position="right" size="lg">
        <Stack component="form" onSubmit={handleSubmit(submitMlcCase)}>
          <Controller
            name="patient_id"
            control={control}
            render={({ field }) => (
              <PatientSearchSelect value={field.value} onChange={field.onChange} required />
            )}
          />
          {errors.patient_id?.message && (
            <Text size="xs" c="danger">
              {errors.patient_id.message}
            </Text>
          )}
          <PatientContextBanner patientId={selectedPatientId} hideLoadingState />
          <Controller
            name="case_type"
            control={control}
            render={({ field }) => (
              <Select
                label="Case Type"
                data={emergencyMlcCaseTypeOptions}
                value={field.value || null}
                onChange={(value) => field.onChange(value ?? "")}
                clearable
                error={errors.case_type?.message}
              />
            )}
          />
          <Controller
            name="fir_number"
            control={control}
            render={({ field }) => <TextInput label="FIR Number" {...field} />}
          />
          <Controller
            name="police_station"
            control={control}
            render={({ field }) => <TextInput label="Police Station" {...field} />}
          />
          <Controller
            name="brought_by"
            control={control}
            render={({ field }) => (
              <Select
                label="Brought By"
                data={emergencyMlcBroughtByOptions}
                value={field.value || null}
                onChange={(value) => field.onChange(value ?? "")}
                clearable
                error={errors.brought_by?.message}
              />
            )}
          />
          <Controller
            name="informant_name"
            control={control}
            render={({ field }) => <TextInput label="Informant Name" {...field} />}
          />
          <Controller
            name="informant_relation"
            control={control}
            render={({ field }) => <TextInput label="Informant Relation" {...field} />}
          />
          <Controller
            name="informant_contact"
            control={control}
            render={({ field }) => (
              <TextInput
                label="Informant Contact"
                {...field}
                error={errors.informant_contact?.message}
              />
            )}
          />
          <Controller
            name="history_of_incident"
            control={control}
            render={({ field }) => <Textarea label="History of Incident" {...field} minRows={3} />}
          />
          <Controller
            name="is_pocso"
            control={control}
            render={({ field }) => (
              <Select
                label="POCSO Case"
                data={[
                  { value: "true", label: "Yes" },
                  { value: "false", label: "No" },
                ]}
                value={field.value ? "true" : "false"}
                onChange={(value) => field.onChange(value === "true")}
              />
            )}
          />
          <Controller
            name="is_death_case"
            control={control}
            render={({ field }) => (
              <Select
                label="Death Case"
                data={[
                  { value: "true", label: "Yes" },
                  { value: "false", label: "No" },
                ]}
                value={field.value ? "true" : "false"}
                onChange={(value) => field.onChange(value === "true")}
              />
            )}
          />
          <Button type="submit" loading={mutation.isPending}>
            Register MLC Case
          </Button>
        </Stack>
      </Drawer>

      {/* MLC Detail Drawer */}
      <Drawer
        opened={detailOpened}
        onClose={() => {
          closeDetail();
          setSelectedCase(null);
        }}
        title={selectedCase ? `MLC Case: ${selectedCase.mlc_number}` : "MLC Case Details"}
        position="right"
        size="xl"
      >
        {selectedCase && <MlcCaseDetail mlcCase={selectedCase} />}
      </Drawer>
    </Stack>
  );
}

// ── Mass Casualty Tab ──────────────────────────────────

function MassCasualtyTab({ canCreate }: { canCreate: boolean }) {
  const [opened, { open, close }] = useDisclosure(false);
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ["mass-casualty"],
    queryFn: () => emergencyService.listMassCasualtyEvents(),
  });

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<MassCasualtyEventFormInput>({
    resolver: zodResolver(massCasualtyEventFormSchema),
    defaultValues: emptyMassCasualtyEventForm,
  });
  const mutation = useMutation({
    mutationFn: (d: CreateMassCasualtyEventRequest) => emergencyService.createMassCasualtyEvent(d),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["mass-casualty"] });
      close();
      notifications.show({
        title: "Code Yellow",
        message: "Mass casualty event activated",
        color: "danger",
      });
    },
  });

  const submitMassCasualtyEvent = (values: MassCasualtyEventFormInput) => {
    mutation.mutate({
      event_name: values.event_name.trim(),
      event_type: values.event_type || undefined,
      location: emergencyOptionalText(values.location),
      estimated_casualties: emergencyOptionalInteger(values.estimated_casualties),
      notes: emergencyOptionalText(values.notes),
    });
  };

  const mcStatusColor = (s: string) => {
    switch (s) {
      case "activated":
        return "danger";
      case "ongoing":
        return "orange";
      case "scaling_down":
        return "warning";
      case "deactivated":
        return "success";
      default:
        return "gray";
    }
  };

  const columns = [
    {
      key: "event_name",
      label: "Event",
      render: (r: MassCasualtyEvent) => <Text fw={600}>{r.event_name}</Text>,
    },
    { key: "event_type", label: "Type", render: (r: MassCasualtyEvent) => r.event_type ?? "---" },
    {
      key: "status",
      label: "Status",
      render: (r: MassCasualtyEvent) => (
        <Badge color={mcStatusColor(r.status)} size="sm">
          {r.status}
        </Badge>
      ),
    },
    {
      key: "activated_at",
      label: "Activated",
      render: (r: MassCasualtyEvent) => new Date(r.activated_at).toLocaleString(),
    },
    {
      key: "estimated_casualties",
      label: "Est. Casualties",
      render: (r: MassCasualtyEvent) => r.estimated_casualties ?? "---",
    },
    {
      key: "actual_casualties",
      label: "Actual",
      render: (r: MassCasualtyEvent) => r.actual_casualties ?? "---",
    },
    { key: "location", label: "Location", render: (r: MassCasualtyEvent) => r.location ?? "---" },
  ];

  return (
    <Stack mt="md">
      {canCreate && (
        <Group justify="flex-end">
          <Button
            leftSection={<IconBell size={16} />}
            color="danger"
            onClick={() => {
              reset(emptyMassCasualtyEventForm);
              open();
            }}
          >
            Activate Mass Casualty
          </Button>
        </Group>
      )}
      <DataTable columns={columns} data={data} loading={isLoading} rowKey={(r) => r.id} />

      <Drawer
        opened={opened}
        onClose={close}
        title="Activate Mass Casualty Event"
        position="right"
        size="xl"
      >
        <Stack component="form" onSubmit={handleSubmit(submitMassCasualtyEvent)}>
          <Controller
            name="event_name"
            control={control}
            render={({ field }) => (
              <TextInput
                label="Event Name"
                required
                {...field}
                error={errors.event_name?.message}
              />
            )}
          />
          <Controller
            name="event_type"
            control={control}
            render={({ field }) => (
              <Select
                label="Event Type"
                data={emergencyMassCasualtyTypeOptions}
                value={field.value || null}
                onChange={(value) => field.onChange(value ?? "")}
                clearable
                error={errors.event_type?.message}
              />
            )}
          />
          <Controller
            name="location"
            control={control}
            render={({ field }) => <TextInput label="Location" {...field} />}
          />
          <Controller
            name="estimated_casualties"
            control={control}
            render={({ field }) => (
              <NumberInput
                label="Estimated Casualties"
                value={field.value}
                onChange={field.onChange}
                error={errors.estimated_casualties?.message}
              />
            )}
          />
          <Controller
            name="notes"
            control={control}
            render={({ field }) => <Textarea label="Notes" {...field} />}
          />
          <Button color="danger" type="submit" loading={mutation.isPending}>
            Activate Mass Casualty
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}
