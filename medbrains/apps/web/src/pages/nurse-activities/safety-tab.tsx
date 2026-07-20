// IPD SafetyTab — split from nurse-activities.tsx (pure move).

import {
  Card,
  Group,
  NumberInput,
  Select,
  SimpleGrid,
  Slider,
  Stack,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
} from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { IconAlertTriangle, IconBandage, IconPlus, IconShieldCheck } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Badge, Button, toast } from "@/components/ui";
import { nurseActivitiesService } from "@/services/nurseActivities.service";
import {
  type ClinicalStatus,
  EncounterContextField,
  encounterLocked,
  formatDateTime,
  NEUTRAL_STATUS,
  statusBadgeTone,
  toNumber,
} from "./shared";

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

export function SafetyTab({
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
