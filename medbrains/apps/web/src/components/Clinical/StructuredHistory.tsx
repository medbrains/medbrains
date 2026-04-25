import { useState } from "react";
import {
  Accordion,
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  Select,
  Stack,
  Text,
  TextInput,
  Textarea,
  NumberInput,
  ThemeIcon,
} from "@mantine/core";
import {
  IconHistory,
  IconPlus,
  IconStethoscope,
  IconTrash,
  IconUsers,
  IconBottle,
} from "@tabler/icons-react";
import type {
  PastMedicalEntry,
  PastSurgicalEntry,
  FamilyHistoryEntry,
  SocialHistory,
} from "@medbrains/types";

interface StructuredHistoryProps {
  hpi: string;
  pastMedical: PastMedicalEntry[];
  pastSurgical: PastSurgicalEntry[];
  familyHistory: FamilyHistoryEntry[];
  socialHistory: SocialHistory;
  canUpdate: boolean;
  onUpdate: (data: {
    hpi?: string;
    past_medical_history?: PastMedicalEntry[];
    past_surgical_history?: PastSurgicalEntry[];
    family_history?: FamilyHistoryEntry[];
    social_history?: SocialHistory;
  }) => void;
}

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "resolved", label: "Resolved" },
  { value: "controlled", label: "Controlled" },
];

const RELATIONS = [
  "Father", "Mother", "Brother", "Sister",
  "Paternal Grandfather", "Paternal Grandmother",
  "Maternal Grandfather", "Maternal Grandmother",
  "Son", "Daughter", "Spouse",
];

const SMOKING_STATUS = [
  { value: "never", label: "Never" },
  { value: "former", label: "Former" },
  { value: "current", label: "Current" },
];

const ALCOHOL_STATUS = [
  { value: "never", label: "Never" },
  { value: "occasional", label: "Occasional" },
  { value: "moderate", label: "Moderate" },
  { value: "heavy", label: "Heavy" },
];

export function StructuredHistory({
  hpi,
  pastMedical,
  pastSurgical,
  familyHistory,
  socialHistory,
  canUpdate,
  onUpdate,
}: StructuredHistoryProps) {
  const [localHpi, setLocalHpi] = useState(hpi);

  // PMH add form
  const [pmhCondition, setPmhCondition] = useState("");
  const [pmhStatus, setPmhStatus] = useState<string>("active");

  // PSH add form
  const [pshProcedure, setPshProcedure] = useState("");
  const [pshYear, setPshYear] = useState<number | "">("");

  // Family add form
  const [fhRelation, setFhRelation] = useState<string | null>(null);
  const [fhCondition, setFhCondition] = useState("");

  const handleHpiBlur = () => {
    if (localHpi !== hpi) {
      onUpdate({ hpi: localHpi });
    }
  };

  const addPmh = () => {
    if (!pmhCondition.trim()) return;
    const updated = [...pastMedical, { condition: pmhCondition.trim(), status: pmhStatus as PastMedicalEntry["status"] }];
    onUpdate({ past_medical_history: updated });
    setPmhCondition("");
  };

  const removePmh = (idx: number) => {
    onUpdate({ past_medical_history: pastMedical.filter((_, i) => i !== idx) });
  };

  const addPsh = () => {
    if (!pshProcedure.trim()) return;
    const entry: PastSurgicalEntry = { procedure: pshProcedure.trim() };
    if (pshYear) entry.year = Number(pshYear);
    const updated = [...pastSurgical, entry];
    onUpdate({ past_surgical_history: updated });
    setPshProcedure("");
    setPshYear("");
  };

  const removePsh = (idx: number) => {
    onUpdate({ past_surgical_history: pastSurgical.filter((_, i) => i !== idx) });
  };

  const addFh = () => {
    if (!fhRelation || !fhCondition.trim()) return;
    const updated = [...familyHistory, { relation: fhRelation, condition: fhCondition.trim() }];
    onUpdate({ family_history: updated });
    setFhCondition("");
    setFhRelation(null);
  };

  const removeFh = (idx: number) => {
    onUpdate({ family_history: familyHistory.filter((_, i) => i !== idx) });
  };

  const updateSocial = (key: string, value: unknown) => {
    onUpdate({ social_history: { ...socialHistory, [key]: value } });
  };

  return (
    <Accordion variant="separated" multiple defaultValue={["hpi"]}>
      {/* HPI */}
      <Accordion.Item value="hpi">
        <Accordion.Control icon={<ThemeIcon variant="light" color="primary" size="sm"><IconStethoscope size={14} /></ThemeIcon>}>
          <Text size="sm" fw={600}>History of Present Illness (HPI)</Text>
        </Accordion.Control>
        <Accordion.Panel>
          <Textarea
            value={localHpi}
            onChange={(e) => setLocalHpi(e.currentTarget.value)}
            onBlur={handleHpiBlur}
            placeholder="Describe the history of the present illness in detail..."
            autosize
            minRows={3}
            maxRows={8}
            disabled={!canUpdate}
          />
        </Accordion.Panel>
      </Accordion.Item>

      {/* Past Medical History */}
      <Accordion.Item value="pmh">
        <Accordion.Control icon={<ThemeIcon variant="light" color="violet" size="sm"><IconHistory size={14} /></ThemeIcon>}>
          <Group gap={8}>
            <Text size="sm" fw={600}>Past Medical History</Text>
            {pastMedical.length > 0 && <Badge size="xs" variant="light" circle>{pastMedical.length}</Badge>}
          </Group>
        </Accordion.Control>
        <Accordion.Panel>
          <Stack gap="xs">
            {canUpdate && (
              <Group gap="xs" align="flex-end">
                <TextInput
                  placeholder="Condition (e.g. Diabetes, Hypertension)"
                  value={pmhCondition}
                  onChange={(e) => setPmhCondition(e.currentTarget.value)}
                  style={{ flex: 1 }}
                  size="sm"
                />
                <Select
                  data={STATUS_OPTIONS}
                  value={pmhStatus}
                  onChange={(v) => setPmhStatus(v ?? "active")}
                  w={120}
                  size="sm"
                />
                <Button size="sm" leftSection={<IconPlus size={14} />} onClick={addPmh} disabled={!pmhCondition.trim()}>
                  Add
                </Button>
              </Group>
            )}
            {pastMedical.map((entry, idx) => (
              <Card key={idx} padding="xs" withBorder>
                <Group justify="space-between">
                  <Group gap={8}>
                    <Text size="sm">{entry.condition}</Text>
                    <Badge size="xs" color={entry.status === "active" ? "danger" : entry.status === "controlled" ? "warning" : "success"} variant="light">
                      {entry.status}
                    </Badge>
                  </Group>
                  {canUpdate && (
                    <ActionIcon variant="subtle" color="danger" size="sm" onClick={() => removePmh(idx)} aria-label="Delete">
                      <IconTrash size={14} />
                    </ActionIcon>
                  )}
                </Group>
              </Card>
            ))}
            {pastMedical.length === 0 && <Text size="sm" c="dimmed" ta="center">No past medical history recorded</Text>}
          </Stack>
        </Accordion.Panel>
      </Accordion.Item>

      {/* Past Surgical History */}
      <Accordion.Item value="psh">
        <Accordion.Control icon={<ThemeIcon variant="light" color="orange" size="sm"><IconStethoscope size={14} /></ThemeIcon>}>
          <Group gap={8}>
            <Text size="sm" fw={600}>Past Surgical History</Text>
            {pastSurgical.length > 0 && <Badge size="xs" variant="light" circle>{pastSurgical.length}</Badge>}
          </Group>
        </Accordion.Control>
        <Accordion.Panel>
          <Stack gap="xs">
            {canUpdate && (
              <Group gap="xs" align="flex-end">
                <TextInput
                  placeholder="Procedure (e.g. Appendectomy)"
                  value={pshProcedure}
                  onChange={(e) => setPshProcedure(e.currentTarget.value)}
                  style={{ flex: 1 }}
                  size="sm"
                />
                <NumberInput
                  placeholder="Year"
                  value={pshYear}
                  onChange={(v) => setPshYear(typeof v === "number" ? v : "")}
                  w={100}
                  size="sm"
                  min={1950}
                  max={new Date().getFullYear()}
                />
                <Button size="sm" leftSection={<IconPlus size={14} />} onClick={addPsh} disabled={!pshProcedure.trim()}>
                  Add
                </Button>
              </Group>
            )}
            {pastSurgical.map((entry, idx) => (
              <Card key={idx} padding="xs" withBorder>
                <Group justify="space-between">
                  <Text size="sm">{entry.procedure}{entry.year ? ` (${entry.year})` : ""}</Text>
                  {canUpdate && (
                    <ActionIcon variant="subtle" color="danger" size="sm" onClick={() => removePsh(idx)} aria-label="Delete">
                      <IconTrash size={14} />
                    </ActionIcon>
                  )}
                </Group>
              </Card>
            ))}
            {pastSurgical.length === 0 && <Text size="sm" c="dimmed" ta="center">No past surgical history recorded</Text>}
          </Stack>
        </Accordion.Panel>
      </Accordion.Item>

      {/* Family History */}
      <Accordion.Item value="family">
        <Accordion.Control icon={<ThemeIcon variant="light" color="teal" size="sm"><IconUsers size={14} /></ThemeIcon>}>
          <Group gap={8}>
            <Text size="sm" fw={600}>Family History</Text>
            {familyHistory.length > 0 && <Badge size="xs" variant="light" circle>{familyHistory.length}</Badge>}
          </Group>
        </Accordion.Control>
        <Accordion.Panel>
          <Stack gap="xs">
            {canUpdate && (
              <Group gap="xs" align="flex-end">
                <Select
                  data={RELATIONS}
                  value={fhRelation}
                  onChange={setFhRelation}
                  placeholder="Relation"
                  w={180}
                  size="sm"
                  searchable
                />
                <TextInput
                  placeholder="Condition"
                  value={fhCondition}
                  onChange={(e) => setFhCondition(e.currentTarget.value)}
                  style={{ flex: 1 }}
                  size="sm"
                />
                <Button size="sm" leftSection={<IconPlus size={14} />} onClick={addFh} disabled={!fhRelation || !fhCondition.trim()}>
                  Add
                </Button>
              </Group>
            )}
            {familyHistory.map((entry, idx) => (
              <Card key={idx} padding="xs" withBorder>
                <Group justify="space-between">
                  <Group gap={8}>
                    <Badge size="xs" variant="outline">{entry.relation}</Badge>
                    <Text size="sm">{entry.condition}</Text>
                  </Group>
                  {canUpdate && (
                    <ActionIcon variant="subtle" color="danger" size="sm" onClick={() => removeFh(idx)} aria-label="Delete">
                      <IconTrash size={14} />
                    </ActionIcon>
                  )}
                </Group>
              </Card>
            ))}
            {familyHistory.length === 0 && <Text size="sm" c="dimmed" ta="center">No family history recorded</Text>}
          </Stack>
        </Accordion.Panel>
      </Accordion.Item>

      {/* Social History */}
      <Accordion.Item value="social">
        <Accordion.Control icon={<ThemeIcon variant="light" color="danger" size="sm"><IconBottle size={14} /></ThemeIcon>}>
          <Text size="sm" fw={600}>Social History</Text>
        </Accordion.Control>
        <Accordion.Panel>
          <Stack gap="sm">
            <Group grow>
              <Select
                label="Smoking"
                data={SMOKING_STATUS}
                value={socialHistory.smoking?.status ?? "never"}
                onChange={(v) => updateSocial("smoking", { ...socialHistory.smoking, status: v })}
                size="sm"
                disabled={!canUpdate}
              />
              <Select
                label="Alcohol"
                data={ALCOHOL_STATUS}
                value={socialHistory.alcohol?.status ?? "never"}
                onChange={(v) => updateSocial("alcohol", { ...socialHistory.alcohol, status: v })}
                size="sm"
                disabled={!canUpdate}
              />
              <Select
                label="Tobacco Chewing"
                data={SMOKING_STATUS}
                value={socialHistory.tobacco_chewing?.status ?? "never"}
                onChange={(v) => updateSocial("tobacco_chewing", { ...socialHistory.tobacco_chewing, status: v })}
                size="sm"
                disabled={!canUpdate}
              />
            </Group>
            <Group grow>
              <TextInput
                label="Occupation"
                value={socialHistory.occupation ?? ""}
                onChange={(e) => updateSocial("occupation", e.currentTarget.value)}
                size="sm"
                disabled={!canUpdate}
              />
              <Select
                label="Diet"
                data={["Vegetarian", "Non-Vegetarian", "Vegan", "Eggetarian"]}
                value={socialHistory.diet ?? null}
                onChange={(v) => updateSocial("diet", v)}
                size="sm"
                disabled={!canUpdate}
              />
              <Select
                label="Exercise"
                data={["Sedentary", "Light", "Moderate", "Active"]}
                value={socialHistory.exercise ?? null}
                onChange={(v) => updateSocial("exercise", v)}
                size="sm"
                disabled={!canUpdate}
              />
            </Group>
          </Stack>
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion>
  );
}
