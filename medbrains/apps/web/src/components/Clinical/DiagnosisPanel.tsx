import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  Modal,
  Select,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
  Timeline,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useFieldAccess, useHasPermission } from "@medbrains/stores";
import {
  type CreateDiagnosisRequest,
  type Diagnosis,
  type DiagnosisCertainty,
  type DiagnosisSeverity,
  type FieldAccessLevel,
  P,
  type PatientDiagnosisRow,
  type SnomedConceptHit,
  type TerminologySearchResult,
  type UpdateDiagnosisRequest,
} from "@medbrains/types";
import { fieldAccessText } from "@medbrains/utils";
import { IconCircleCheck, IconPlus, IconRotateClockwise, IconTrash } from "@tabler/icons-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  DIAGNOSIS_TERMINOLOGY_POLICY,
  terminologySearchPlaceholder,
  terminologySourceLabel,
  terminologySystemLabel,
} from "@/domain/clinical/terminology-policy";
import { todayDateString } from "@/lib/date-utils";
import styles from "./diagnosis-panel.module.scss";
import { Icd11CodeSelect } from "./Icd11CodeSelect";
import { SnomedConceptSelect } from "./SnomedConceptSelect";

interface DiagnosisPanelProps {
  encounterId: string;
  diagnoses: Diagnosis[];
  patientDiagnoses?: PatientDiagnosisRow[];
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  onAdd: (data: CreateDiagnosisRequest) => void;
  onUpdate?: (encounterId: string, diagnosisId: string, data: UpdateDiagnosisRequest) => void;
  onDelete: (id: string) => void;
  isAdding?: boolean;
  isUpdating?: boolean;
}

type ResolutionMode = "resolved" | "ruled_out";

const SEVERITY_OPTIONS: { value: DiagnosisSeverity; label: string }[] = [
  { value: "mild", label: "Mild" },
  { value: "moderate", label: "Moderate" },
  { value: "severe", label: "Severe" },
  { value: "critical", label: "Critical" },
];

const CERTAINTY_OPTIONS: { value: DiagnosisCertainty; label: string }[] = [
  { value: "confirmed", label: "Confirmed" },
  { value: "probable", label: "Probable" },
  { value: "suspected", label: "Suspected" },
  { value: "ruled_out", label: "Ruled Out" },
];

const SEVERITY_COLORS: Record<string, string> = {
  mild: "success",
  moderate: "warning",
  severe: "orange",
  critical: "danger",
};

const CERTAINTY_COLORS: Record<string, string> = {
  confirmed: "primary",
  probable: "teal",
  suspected: "warning",
  ruled_out: "slate",
};

function isDiagnosisSeverity(value: string | null): value is DiagnosisSeverity {
  return value === "mild" || value === "moderate" || value === "severe" || value === "critical";
}

function isDiagnosisCertainty(value: string | null): value is DiagnosisCertainty {
  return (
    value === "confirmed" || value === "probable" || value === "suspected" || value === "ruled_out"
  );
}

function todayIsoDate(): string {
  return todayDateString();
}

function canEditDiagnosisField(access: FieldAccessLevel): boolean {
  return access === "edit";
}

/** Who made it — the visit's doctor only stands in when nobody was recorded. */
function diagnosisAuthor(d: { recorded_by_name?: string | null; doctor_name?: string | null }) {
  if (d.recorded_by_name) return `Recorded by ${d.recorded_by_name}`;
  return d.doctor_name
    ? `Visit doctor ${d.doctor_name} (author not recorded)`
    : "Author not recorded";
}

function displayDate(value: string | null | undefined): string {
  if (!value) return "Not dated";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
}

function diagnosisStatus(diagnosis: Pick<Diagnosis, "certainty" | "resolved_date">): {
  label: string;
  color: string;
} {
  if (diagnosis.certainty === "ruled_out") return { label: "Ruled out", color: "slate" };
  if (diagnosis.resolved_date) return { label: "Resolved", color: "success" };
  return { label: "Active", color: "primary" };
}

function appendDiagnosisNote(
  existing: string | null | undefined,
  action: string,
  note: string,
): string {
  const cleanNote = note.trim();
  const line = cleanNote
    ? `${todayIsoDate()} - ${action}: ${cleanNote}`
    : `${todayIsoDate()} - ${action}`;
  return [existing?.trim(), line].filter(Boolean).join("\n");
}

export function DiagnosisPanel({
  encounterId,
  diagnoses,
  patientDiagnoses = [],
  canCreate,
  canUpdate,
  canDelete,
  onAdd,
  onUpdate,
  onDelete,
  isAdding,
  isUpdating,
}: DiagnosisPanelProps) {
  const { t } = useTranslation("clinical");
  const diagnosisAccess = useFieldAccess("opd.diagnosis");
  const hasDiagnosisCreatePermission = useHasPermission(P.OPD.DIAGNOSES.CREATE);
  const hasDiagnosisUpdatePermission = useHasPermission(P.OPD.DIAGNOSES.UPDATE);
  const hasDiagnosisDeletePermission = useHasPermission(P.OPD.DIAGNOSES.DELETE);
  const [description, setDescription] = useState("");
  const [icdCode, setIcdCode] = useState("");
  const [selectedIcd11, setSelectedIcd11] = useState<TerminologySearchResult | null>(null);
  const [snomedCode, setSnomedCode] = useState("");
  const [snomedDisplay, setSnomedDisplay] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);
  const [severity, setSeverity] = useState<DiagnosisSeverity | null>("moderate");
  const [certainty, setCertainty] = useState<DiagnosisCertainty | null>("confirmed");
  const [resolutionTarget, setResolutionTarget] = useState<Diagnosis | null>(null);
  const [resolutionMode, setResolutionMode] = useState<ResolutionMode>("resolved");
  const [resolutionNote, setResolutionNote] = useState("");
  const [resolutionOpened, resolutionHandlers] = useDisclosure(false);
  const primarySystem = DIAGNOSIS_TERMINOLOGY_POLICY.primarySystem;
  // SNOMED CT alongside ICD-11, for those who may browse it; stored in
  // diagnoses.snomed_code and counted by hierarchy in SNOMED analytics.
  const canCodeSnomed = useHasPermission(P.TERMINOLOGY.SNOMED.VIEW);
  const canEditDiagnosis = canEditDiagnosisField(diagnosisAccess);
  const canCreateDiagnosis = canCreate && hasDiagnosisCreatePermission && canEditDiagnosis;
  const canUpdateDiagnosis = canUpdate && hasDiagnosisUpdatePermission && canEditDiagnosis;
  const canDeleteDiagnosis = canDelete && hasDiagnosisDeletePermission && canEditDiagnosis;
  const canShowDiagnosisDetails = diagnosisAccess === "edit" || diagnosisAccess === "view";
  const diagnosisText = (value: string | null | undefined) =>
    fieldAccessText(diagnosisAccess, value);

  const handleSnomedSelect = (hit: SnomedConceptHit | null) => {
    const term = hit?.preferred_term ?? hit?.fsn ?? "";
    setSnomedCode(hit?.concept_id ?? "");
    setSnomedDisplay(term);
    if (hit && !description.trim()) {
      setDescription(term);
    }
  };

  const handleIcdCodeChange = (nextValue: string | undefined) => {
    setIcdCode(nextValue ?? "");
    if (!nextValue) {
      setSelectedIcd11(null);
      setDescription("");
    }
  };

  const handleIcdResultSelect = (result: TerminologySearchResult) => {
    setSelectedIcd11(result);
    setIcdCode(result.code);
    setDescription(result.display);
  };

  const handleAdd = () => {
    if (!canCreateDiagnosis || !description.trim()) return;
    onAdd({
      description: description.trim(),
      icd_code: icdCode.trim() || undefined,
      icd_system: icdCode.trim() ? primarySystem : undefined,
      icd_display: selectedIcd11?.display,
      icd_source_url: selectedIcd11?.source_url ?? undefined,
      icd_source_version: selectedIcd11?.source_version ?? undefined,
      icd_provider_mode: selectedIcd11?.provider_mode,
      is_primary: isPrimary,
      severity: severity ?? undefined,
      certainty: certainty ?? undefined,
      snomed_code: snomedCode.trim() || undefined,
      snomed_display: snomedDisplay.trim() || undefined,
    });
    setDescription("");
    setIcdCode("");
    setSelectedIcd11(null);
    setSnomedCode("");
    setSnomedDisplay("");
    setIsPrimary(false);
    setSeverity("moderate");
    setCertainty("confirmed");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleAdd();
    }
  };

  const openResolutionModal = (diagnosis: Diagnosis, mode: ResolutionMode) => {
    if (!canUpdateDiagnosis) return;
    setResolutionTarget(diagnosis);
    setResolutionMode(mode);
    setResolutionNote("");
    resolutionHandlers.open();
  };

  const handleResolve = () => {
    if (!resolutionTarget || !onUpdate || !canUpdateDiagnosis) return;
    const action = resolutionMode === "ruled_out" ? "Ruled out" : "Resolved";
    onUpdate(resolutionTarget.encounter_id, resolutionTarget.id, {
      certainty: resolutionMode === "ruled_out" ? "ruled_out" : "confirmed",
      resolved_date: todayIsoDate(),
      notes: appendDiagnosisNote(resolutionTarget.notes, action, resolutionNote),
    });
    resolutionHandlers.close();
  };

  const handleReopen = (diagnosis: Diagnosis) => {
    if (!onUpdate || !canUpdateDiagnosis) return;
    onUpdate(diagnosis.encounter_id, diagnosis.id, {
      certainty: "confirmed",
      resolved_date: null,
      notes: appendDiagnosisNote(diagnosis.notes, "Reopened", "Diagnosis reopened for follow-up"),
    });
  };

  const activeTimelineCount = patientDiagnoses.filter(
    (diagnosis) => !diagnosis.resolved_date && diagnosis.certainty !== "ruled_out",
  ).length;

  return (
    <Stack gap="sm">
      <Modal
        opened={resolutionOpened}
        onClose={resolutionHandlers.close}
        title={resolutionMode === "ruled_out" ? "Rule Out Diagnosis" : "Resolve Diagnosis"}
        size="lg"
      >
        <Stack gap="sm">
          <Text size="sm" fw={600}>
            {diagnosisText(resolutionTarget?.description)}
          </Text>
          <Textarea
            label="Resolution notes"
            description="Add what changed clinically, treatment response, follow-up advice, or why the diagnosis was ruled out."
            placeholder="Example: Symptoms resolved after treatment. No further fever for 72 hours. Review if symptoms recur."
            minRows={5}
            autosize
            value={resolutionNote}
            onChange={(event) => setResolutionNote(event.currentTarget.value)}
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={resolutionHandlers.close}>
              Cancel
            </Button>
            <Button
              color={resolutionMode === "ruled_out" ? "slate" : "success"}
              leftSection={<IconCircleCheck size={14} />}
              onClick={handleResolve}
              loading={isUpdating}
            >
              {resolutionMode === "ruled_out" ? "Mark Ruled Out" : "Mark Resolved"}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {canCreateDiagnosis && (
        <Stack gap="xs">
          <Group gap="xs" align="flex-end" wrap="nowrap">
            <Icd11CodeSelect
              placeholder={terminologySearchPlaceholder(primarySystem)}
              value={icdCode || null}
              onChange={handleIcdCodeChange}
              onSelectResult={handleIcdResultSelect}
              w={300}
              size="sm"
              limit={15}
            />
            <TextInput
              placeholder={t("diagnosis.description")}
              value={description}
              onChange={(e) => setDescription(e.currentTarget.value)}
              onKeyDown={handleKeyDown}
              style={{ flex: 1 }}
              size="sm"
            />
          </Group>
          <Group gap="xs" align="flex-end">
            {icdCode && (
              <Badge size="sm" variant="light" color="primary">
                {terminologySystemLabel(primarySystem)}: {icdCode}
              </Badge>
            )}
            <Badge size="sm" variant="outline" color="slate">
              {terminologySourceLabel(primarySystem)}
            </Badge>
            {snomedCode && (
              <Badge size="sm" variant="light" color="teal">
                SNOMED CT: {snomedCode}
              </Badge>
            )}
            <Select
              data={SEVERITY_OPTIONS}
              value={severity}
              onChange={(value) => setSeverity(isDiagnosisSeverity(value) ? value : null)}
              placeholder="Severity"
              w={120}
              size="sm"
            />
            <Select
              data={CERTAINTY_OPTIONS}
              value={certainty}
              onChange={(value) => setCertainty(isDiagnosisCertainty(value) ? value : null)}
              placeholder="Certainty"
              w={120}
              size="sm"
            />
            <Switch
              label={t("diagnosis.primary")}
              checked={isPrimary}
              onChange={(e) => setIsPrimary(e.currentTarget.checked)}
              size="sm"
            />
            <Button
              size="sm"
              leftSection={<IconPlus size={14} />}
              onClick={handleAdd}
              loading={isAdding}
              disabled={!description.trim()}
            >
              {t("common:add")}
            </Button>
          </Group>
          {canCodeSnomed && (
            <SnomedConceptSelect
              aria-label="SNOMED CT concept"
              placeholder="SNOMED CT concept (optional)"
              value={snomedCode || null}
              displayValue={snomedDisplay}
              onChange={handleSnomedSelect}
              size="sm"
            />
          )}
        </Stack>
      )}

      {diagnoses.length === 0 && (
        <Text size="sm" c="dimmed" ta="center" py="md">
          {t("diagnosis.noDiagnoses")}
        </Text>
      )}

      {diagnoses.map((d) => (
        <Card
          key={d.id}
          className={styles.diagnosisCard}
          style={{
            borderLeftColor: d.is_primary
              ? "var(--mantine-color-orange-5)"
              : "var(--mantine-color-gray-3)",
          }}
          padding="sm"
          radius="md"
        >
          <Group justify="space-between" wrap="nowrap">
            <div>
              <Group gap={8}>
                <Text size="sm" fw={500}>
                  {diagnosisText(d.description)}
                </Text>
                <Badge size="xs" color={diagnosisStatus(d).color} variant="light">
                  {diagnosisStatus(d).label}
                </Badge>
                {d.is_primary && (
                  <Badge size="xs" color="orange" variant="light">
                    {t("diagnosis.primary")}
                  </Badge>
                )}
              </Group>
              <Group gap={6} mt={4}>
                {canShowDiagnosisDetails && d.icd_code && (
                  <Badge size="xs" variant="outline" color="slate">
                    {terminologySystemLabel(d.icd_system)}: {d.icd_code}
                  </Badge>
                )}
                {canShowDiagnosisDetails && d.snomed_code && (
                  <Badge size="xs" variant="light" color="teal">
                    SNOMED CT: {d.snomed_code}
                  </Badge>
                )}
                {canShowDiagnosisDetails && d.severity && (
                  <Badge size="xs" variant="light" color={SEVERITY_COLORS[d.severity] ?? "slate"}>
                    {d.severity}
                  </Badge>
                )}
                {canShowDiagnosisDetails && d.certainty && (
                  <Badge size="xs" variant="dot" color={CERTAINTY_COLORS[d.certainty] ?? "slate"}>
                    {d.certainty}
                  </Badge>
                )}
                {canShowDiagnosisDetails && d.resolved_date && (
                  <Badge size="xs" variant="outline" color="success">
                    resolved {displayDate(d.resolved_date)}
                  </Badge>
                )}
              </Group>
              {canShowDiagnosisDetails && d.notes && (
                <Text size="xs" c="dimmed" mt={6} style={{ whiteSpace: "pre-wrap" }}>
                  {diagnosisText(d.notes)}
                </Text>
              )}
            </div>
            {(canUpdateDiagnosis || canDeleteDiagnosis) && (
              <Group gap={4} wrap="nowrap">
                {canUpdateDiagnosis &&
                  (d.resolved_date || d.certainty === "ruled_out" ? (
                    <Button
                      size="compact-xs"
                      variant="light"
                      leftSection={<IconRotateClockwise size={12} />}
                      onClick={() => handleReopen(d)}
                      loading={isUpdating}
                    >
                      Reopen
                    </Button>
                  ) : (
                    <>
                      <Button
                        size="compact-xs"
                        variant="light"
                        color="success"
                        leftSection={<IconCircleCheck size={12} />}
                        onClick={() => openResolutionModal(d, "resolved")}
                      >
                        Resolve
                      </Button>
                      <Button
                        size="compact-xs"
                        variant="light"
                        color="slate"
                        onClick={() => openResolutionModal(d, "ruled_out")}
                      >
                        Rule out
                      </Button>
                    </>
                  ))}
                {canDeleteDiagnosis && (
                  <ActionIcon
                    variant="subtle"
                    color="danger"
                    size="sm"
                    onClick={() => {
                      if (canDeleteDiagnosis) onDelete(d.id);
                    }}
                    disabled={!canDeleteDiagnosis}
                    aria-label="Delete"
                  >
                    <IconTrash size={14} />
                  </ActionIcon>
                )}
              </Group>
            )}
          </Group>
        </Card>
      ))}

      {patientDiagnoses.length > 0 && (
        <Card padding="sm" radius="md" withBorder>
          <Group justify="space-between" mb="xs">
            <Text size="sm" fw={700}>
              Diagnosis timeline
            </Text>
            <Badge size="xs" variant="light" color={activeTimelineCount > 0 ? "primary" : "slate"}>
              {activeTimelineCount} active
            </Badge>
          </Group>
          <Timeline bulletSize={18} lineWidth={2} color="primary">
            {patientDiagnoses.map((diagnosis) => {
              const status = diagnosisStatus(diagnosis);
              const isCurrentEncounter = diagnosis.encounter_id === encounterId;
              return (
                <Timeline.Item key={diagnosis.id} color={status.color}>
                  <Group gap={6} mb={2}>
                    <Text size="sm" fw={600}>
                      {diagnosisText(diagnosis.description)}
                    </Text>
                    <Badge size="xs" color={status.color} variant="light">
                      {status.label}
                    </Badge>
                    {isCurrentEncounter && (
                      <Badge size="xs" color="primary" variant="outline">
                        current
                      </Badge>
                    )}
                  </Group>
                  <Group gap={6}>
                    {canShowDiagnosisDetails && diagnosis.icd_code && (
                      <Badge size="xs" variant="outline" color="slate">
                        {terminologySystemLabel(diagnosis.icd_system)}: {diagnosis.icd_code}
                      </Badge>
                    )}
                    {canShowDiagnosisDetails && diagnosis.snomed_code && (
                      <Badge size="xs" variant="light" color="teal">
                        SNOMED CT: {diagnosis.snomed_code}
                      </Badge>
                    )}
                  </Group>
                  <Text size="xs" c="dimmed" mt={4}>
                    {displayDate(diagnosis.created_at)} · {diagnosisAuthor(diagnosis)}
                    {diagnosis.updated_by_name && diagnosis.updated_at
                      ? ` · changed by ${diagnosis.updated_by_name} ${displayDate(diagnosis.updated_at)}`
                      : ""}
                    {canShowDiagnosisDetails && diagnosis.resolved_date
                      ? ` · resolved ${displayDate(diagnosis.resolved_date)}`
                      : ""}
                  </Text>
                  {canShowDiagnosisDetails && diagnosis.notes && (
                    <Text size="xs" mt={4} style={{ whiteSpace: "pre-wrap" }}>
                      {diagnosisText(diagnosis.notes)}
                    </Text>
                  )}
                </Timeline.Item>
              );
            })}
          </Timeline>
        </Card>
      )}
    </Stack>
  );
}
