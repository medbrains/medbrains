import { useMemo, useState } from "react";
import {
  ActionIcon,
  Alert,
  Button,
  Card,
  Group,
  Loader,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import {
  IconHeartbeat,
  IconPlus,
  IconTrash,
  IconArrowRight,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import type { TenantSettingsRow } from "@medbrains/types";
import { notifications } from "@mantine/notifications";
import { useNavigate } from "react-router";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const VITAL_PARAMETERS = [
  { key: "temperature", label: "Temperature" },
  { key: "pulse", label: "Pulse" },
  { key: "spo2", label: "SpO2" },
  { key: "respiratory_rate", label: "Respiratory Rate" },
  { key: "systolic_bp", label: "Systolic BP" },
  { key: "diastolic_bp", label: "Diastolic BP" },
  { key: "weight", label: "Weight" },
  { key: "height", label: "Height" },
  { key: "pain_score", label: "Pain Score" },
  { key: "gcs", label: "GCS" },
  { key: "blood_glucose", label: "Blood Glucose" },
] as const;

const SOAP_SECTIONS = [
  { key: "chief_complaint", label: "Chief Complaint" },
  { key: "hpi", label: "History of Present Illness" },
  { key: "past_medical", label: "Past Medical History" },
  { key: "past_surgical", label: "Past Surgical History" },
  { key: "family", label: "Family History" },
  { key: "social", label: "Social History" },
  { key: "ros", label: "Review of Systems" },
  { key: "physical_exam", label: "Physical Examination" },
  { key: "plan", label: "Plan" },
] as const;

const FREQUENCY_OPTIONS = [
  { value: "4", label: "Every 4 hours" },
  { value: "6", label: "Every 6 hours" },
  { value: "8", label: "Every 8 hours" },
  { value: "12", label: "Every 12 hours" },
];

interface RosSystemItem {
  key: string;
  label: string;
}

interface DischargeChecklistItem {
  item: string;
  required: boolean;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function parseSetting<T>(rows: TenantSettingsRow[], key: string, fallback: T): T {
  const row = rows.find((r) => r.key === key);
  if (!row) return fallback;
  if (typeof row.value === "string") {
    try {
      return JSON.parse(row.value) as T;
    } catch {
      return fallback;
    }
  }
  return row.value as T;
}

/* ------------------------------------------------------------------ */
/*  Sub-components (each card)                                         */
/* ------------------------------------------------------------------ */

function VitalParametersCard({
  enabled,
  onToggle,
  isPending,
}: {
  enabled: string[];
  onToggle: (key: string, checked: boolean) => void;
  isPending: boolean;
}) {
  return (
    <Card padding="md" radius="md" withBorder>
      <Title order={5} mb="sm">Vital Parameters</Title>
      <Text size="xs" c="dimmed" mb="md">
        Select which vital signs are recorded during consultations and nursing assessments.
      </Text>
      <Stack gap="sm">
        {VITAL_PARAMETERS.map((v) => (
          <Group key={v.key} justify="space-between" wrap="nowrap">
            <Text size="sm">{v.label}</Text>
            <Switch
              checked={enabled.includes(v.key)}
              onChange={(e) => onToggle(v.key, e.currentTarget.checked)}
              disabled={isPending}
            />
          </Group>
        ))}
      </Stack>
    </Card>
  );
}

function RosSystemsCard({
  items,
  onSave,
  isPending,
}: {
  items: RosSystemItem[];
  onSave: (items: RosSystemItem[]) => void;
  isPending: boolean;
}) {
  const [local, setLocal] = useState<RosSystemItem[]>(items);
  const isDirty = JSON.stringify(local) !== JSON.stringify(items);

  const handleAdd = () => {
    setLocal([...local, { key: "", label: "" }]);
  };

  const handleRemove = (idx: number) => {
    setLocal(local.filter((_, i) => i !== idx));
  };

  const handleChange = (idx: number, field: "key" | "label", val: string) => {
    setLocal(local.map((item, i) => (i === idx ? { ...item, [field]: val } : item)));
  };

  return (
    <Card padding="md" radius="md" withBorder>
      <Group justify="space-between" mb="sm">
        <div>
          <Title order={5}>Review of Systems</Title>
          <Text size="xs" c="dimmed">
            Define body system categories for the ROS section in consultations.
          </Text>
        </div>
        <Button
          size="xs"
          variant="light"
          leftSection={<IconPlus size={14} />}
          onClick={handleAdd}
        >
          Add System
        </Button>
      </Group>
      <Stack gap="xs">
        {local.map((item, idx) => (
          <Group key={idx} gap="xs" wrap="nowrap">
            <TextInput
              size="xs"
              placeholder="Key (e.g. cardiovascular)"
              value={item.key}
              onChange={(e) => handleChange(idx, "key", e.currentTarget.value)}
              style={{ flex: 1 }}
            />
            <TextInput
              size="xs"
              placeholder="Label (e.g. Cardiovascular)"
              value={item.label}
              onChange={(e) => handleChange(idx, "label", e.currentTarget.value)}
              style={{ flex: 1 }}
            />
            <ActionIcon
              variant="subtle"
              color="red"
              size="sm"
              onClick={() => handleRemove(idx)}
            >
              <IconTrash size={14} />
            </ActionIcon>
          </Group>
        ))}
        {local.length === 0 && (
          <Text size="xs" c="dimmed" ta="center">No systems defined. Click Add System to begin.</Text>
        )}
      </Stack>
      {isDirty && (
        <Group justify="flex-end" mt="sm">
          <Button size="xs" onClick={() => onSave(local)} loading={isPending}>
            Save ROS Systems
          </Button>
        </Group>
      )}
    </Card>
  );
}

function ConsultationSectionsCard({
  enabled,
  onToggle,
  isPending,
}: {
  enabled: string[];
  onToggle: (key: string, checked: boolean) => void;
  isPending: boolean;
}) {
  return (
    <Card padding="md" radius="md" withBorder>
      <Title order={5} mb="sm">Consultation Sections</Title>
      <Text size="xs" c="dimmed" mb="md">
        Enable or disable SOAP note sections shown during OPD consultations.
      </Text>
      <Stack gap="sm">
        {SOAP_SECTIONS.map((s) => (
          <Group key={s.key} justify="space-between" wrap="nowrap">
            <Text size="sm">{s.label}</Text>
            <Switch
              checked={enabled.includes(s.key)}
              onChange={(e) => onToggle(s.key, e.currentTarget.checked)}
              disabled={isPending}
            />
          </Group>
        ))}
      </Stack>
    </Card>
  );
}

function OrderSetTemplatesCard() {
  const navigate = useNavigate();

  return (
    <Card padding="md" radius="md" withBorder>
      <Group justify="space-between" wrap="nowrap">
        <div>
          <Title order={5}>Order Set Templates</Title>
          <Text size="xs" c="dimmed">
            Create and manage predefined order sets for common clinical scenarios.
          </Text>
        </div>
        <Button
          size="sm"
          variant="light"
          rightSection={<IconArrowRight size={14} />}
          onClick={() => navigate("/admin/order-sets")}
        >
          Manage Order Sets
        </Button>
      </Group>
    </Card>
  );
}

function DischargeChecklistCard({
  items,
  onSave,
  isPending,
}: {
  items: DischargeChecklistItem[];
  onSave: (items: DischargeChecklistItem[]) => void;
  isPending: boolean;
}) {
  const [local, setLocal] = useState<DischargeChecklistItem[]>(items);
  const isDirty = JSON.stringify(local) !== JSON.stringify(items);

  const handleAdd = () => {
    setLocal([...local, { item: "", required: false }]);
  };

  const handleRemove = (idx: number) => {
    setLocal(local.filter((_, i) => i !== idx));
  };

  const handleItemChange = (idx: number, val: string) => {
    setLocal(local.map((it, i) => (i === idx ? { ...it, item: val } : it)));
  };

  const handleRequiredToggle = (idx: number, checked: boolean) => {
    setLocal(local.map((it, i) => (i === idx ? { ...it, required: checked } : it)));
  };

  return (
    <Card padding="md" radius="md" withBorder>
      <Group justify="space-between" mb="sm">
        <div>
          <Title order={5}>Discharge Checklist</Title>
          <Text size="xs" c="dimmed">
            Define items that must be completed before a patient can be discharged.
          </Text>
        </div>
        <Button
          size="xs"
          variant="light"
          leftSection={<IconPlus size={14} />}
          onClick={handleAdd}
        >
          Add Item
        </Button>
      </Group>
      <Stack gap="xs">
        {local.map((it, idx) => (
          <Group key={idx} gap="xs" wrap="nowrap">
            <TextInput
              size="xs"
              placeholder="Checklist item (e.g. Discharge summary signed)"
              value={it.item}
              onChange={(e) => handleItemChange(idx, e.currentTarget.value)}
              style={{ flex: 1 }}
            />
            <Switch
              size="xs"
              label="Required"
              checked={it.required}
              onChange={(e) => handleRequiredToggle(idx, e.currentTarget.checked)}
            />
            <ActionIcon
              variant="subtle"
              color="red"
              size="sm"
              onClick={() => handleRemove(idx)}
            >
              <IconTrash size={14} />
            </ActionIcon>
          </Group>
        ))}
        {local.length === 0 && (
          <Text size="xs" c="dimmed" ta="center">No checklist items defined. Click Add Item to begin.</Text>
        )}
      </Stack>
      {isDirty && (
        <Group justify="flex-end" mt="sm">
          <Button size="xs" onClick={() => onSave(local)} loading={isPending}>
            Save Checklist
          </Button>
        </Group>
      )}
    </Card>
  );
}

function RecordingFrequencyCard({
  frequency,
  onSave,
  isPending,
}: {
  frequency: string;
  onSave: (value: string) => void;
  isPending: boolean;
}) {
  const [local, setLocal] = useState(frequency);
  const isDirty = local !== frequency;

  return (
    <Card padding="md" radius="md" withBorder>
      <Title order={5} mb="sm">Recording Frequency</Title>
      <Text size="xs" c="dimmed" mb="md">
        Default frequency for IPD vital sign recordings.
      </Text>
      <Group gap="sm">
        <Select
          size="sm"
          data={FREQUENCY_OPTIONS}
          value={local}
          onChange={(v) => setLocal(v ?? "6")}
          style={{ flex: 1, maxWidth: 240 }}
        />
        {isDirty && (
          <Button size="sm" onClick={() => onSave(local)} loading={isPending}>
            Save
          </Button>
        )}
      </Group>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export function ClinicalConfigSettings() {
  const queryClient = useQueryClient();

  const { data: raw = [], isLoading } = useQuery({
    queryKey: ["tenant-settings", "clinical"],
    queryFn: () => api.getTenantSettings("clinical"),
    staleTime: 300_000,
  });

  const vitalParameters = useMemo(
    () => parseSetting<string[]>(raw, "vital_parameters", VITAL_PARAMETERS.map((v) => v.key)),
    [raw],
  );

  const rosSystems = useMemo(
    () => parseSetting<RosSystemItem[]>(raw, "ros_systems", []),
    [raw],
  );

  const consultationSections = useMemo(
    () => parseSetting<string[]>(raw, "consultation_sections", SOAP_SECTIONS.map((s) => s.key)),
    [raw],
  );

  const dischargeChecklist = useMemo(
    () => parseSetting<DischargeChecklistItem[]>(raw, "discharge_checklist", []),
    [raw],
  );

  const vitalsFrequency = useMemo(
    () => parseSetting<string>(raw, "vitals_recording_frequency", "6"),
    [raw],
  );

  const updateMutation = useMutation({
    mutationFn: (data: { key: string; value: unknown }) =>
      api.updateTenantSetting({ category: "clinical", key: data.key, value: data.value }),
    onSuccess: (_data, variables) => {
      queryClient.setQueryData<TenantSettingsRow[]>(
        ["tenant-settings", "clinical"],
        (old) => {
          if (!old) return old;
          const exists = old.find((r) => r.key === variables.key);
          if (exists) {
            return old.map((r) => r.key === variables.key ? { ...r, value: variables.value } : r);
          }
          return [
            ...old,
            {
              id: "",
              tenant_id: "",
              category: "clinical",
              key: variables.key,
              value: variables.value,
              created_at: "",
              updated_at: "",
            },
          ];
        },
      );
      notifications.show({ title: "Updated", message: `${variables.key} saved`, color: "success" });
    },
  });

  const handleVitalToggle = (key: string, checked: boolean) => {
    const next = checked
      ? [...vitalParameters, key]
      : vitalParameters.filter((k) => k !== key);
    updateMutation.mutate({ key: "vital_parameters", value: next });
  };

  const handleConsultationToggle = (key: string, checked: boolean) => {
    const next = checked
      ? [...consultationSections, key]
      : consultationSections.filter((k) => k !== key);
    updateMutation.mutate({ key: "consultation_sections", value: next });
  };

  if (isLoading) {
    return <Loader size="sm" />;
  }

  return (
    <Stack gap="lg">
      <Alert icon={<IconHeartbeat size={20} />} color="primary" variant="light">
        <Text size="sm">
          Configure clinical documentation settings for your hospital. These settings
          control which vitals are captured, which consultation sections are shown, and
          the default recording frequency for inpatient monitoring.
        </Text>
      </Alert>

      <VitalParametersCard
        enabled={vitalParameters}
        onToggle={handleVitalToggle}
        isPending={updateMutation.isPending}
      />

      <RosSystemsCard
        items={rosSystems}
        onSave={(items) => updateMutation.mutate({ key: "ros_systems", value: items })}
        isPending={updateMutation.isPending}
      />

      <ConsultationSectionsCard
        enabled={consultationSections}
        onToggle={handleConsultationToggle}
        isPending={updateMutation.isPending}
      />

      <OrderSetTemplatesCard />

      <DischargeChecklistCard
        items={dischargeChecklist}
        onSave={(items) => updateMutation.mutate({ key: "discharge_checklist", value: items })}
        isPending={updateMutation.isPending}
      />

      <RecordingFrequencyCard
        frequency={vitalsFrequency}
        onSave={(val) => updateMutation.mutate({ key: "vitals_recording_frequency", value: val })}
        isPending={updateMutation.isPending}
      />
    </Stack>
  );
}
