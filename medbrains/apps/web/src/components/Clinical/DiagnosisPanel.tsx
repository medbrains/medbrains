import { useState, useMemo } from "react";
import {
  ActionIcon,
  Autocomplete,
  Badge,
  Button,
  Card,
  Group,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
} from "@mantine/core";
import { IconPlus, IconSearch, IconTrash } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import type { CreateDiagnosisRequest, Diagnosis, DiagnosisSeverity, DiagnosisCertainty, SnomedCode } from "@medbrains/types";
import styles from "./diagnosis-panel.module.scss";

interface DiagnosisPanelProps {
  encounterId: string;
  diagnoses: Diagnosis[];
  canUpdate: boolean;
  onAdd: (data: CreateDiagnosisRequest) => void;
  onDelete: (id: string) => void;
  isAdding?: boolean;
}

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

export function DiagnosisPanel({
  diagnoses,
  canUpdate,
  onAdd,
  onDelete,
  isAdding,
}: DiagnosisPanelProps) {
  const { t } = useTranslation("clinical");
  const [description, setDescription] = useState("");
  const [icdCode, setIcdCode] = useState("");
  const [icdSearch, setIcdSearch] = useState("");
  const [snomedCode, setSnomedCode] = useState("");
  const [snomedDisplay, setSnomedDisplay] = useState("");
  const [snomedSearch, setSnomedSearch] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);
  const [severity, setSeverity] = useState<string | null>("moderate");
  const [certainty, setCertainty] = useState<string | null>("confirmed");

  // ICD-10 autocomplete search
  const { data: icdResults } = useQuery({
    queryKey: ["icd10-search", icdSearch],
    queryFn: () => api.searchIcd10(icdSearch, 15),
    enabled: icdSearch.length >= 2,
    staleTime: 30_000,
  });

  const icdOptions = useMemo(
    () => (icdResults ?? []).map((r) => ({
      value: `${r.code} — ${r.short_desc}`,
      code: r.code,
      desc: r.short_desc,
    })),
    [icdResults],
  );

  // SNOMED CT autocomplete search
  const { data: snomedResults } = useQuery({
    queryKey: ["snomed-search", snomedSearch],
    queryFn: () => api.searchSnomed(snomedSearch, 15),
    enabled: snomedSearch.length >= 2,
    staleTime: 30_000,
  });

  const snomedOptions = useMemo(
    () => (snomedResults ?? []).map((r: SnomedCode) => ({
      value: `${r.code} — ${r.display_name}`,
      code: r.code,
      display: r.display_name,
    })),
    [snomedResults],
  );

  const handleIcdSelect = (val: string) => {
    const match = icdOptions.find((o) => o.value === val);
    if (match) {
      setIcdCode(match.code);
      if (!description.trim()) {
        setDescription(match.desc);
      }
    }
    setIcdSearch(val);
  };

  const handleSnomedSelect = (val: string) => {
    const match = snomedOptions.find((o) => o.value === val);
    if (match) {
      setSnomedCode(match.code);
      setSnomedDisplay(match.display);
      if (!description.trim()) {
        setDescription(match.display);
      }
    }
    setSnomedSearch(val);
  };

  const handleAdd = () => {
    if (!description.trim()) return;
    onAdd({
      description: description.trim(),
      icd_code: icdCode.trim() || undefined,
      is_primary: isPrimary,
      severity: (severity as DiagnosisSeverity) ?? undefined,
      certainty: (certainty as DiagnosisCertainty) ?? undefined,
      snomed_code: snomedCode.trim() || undefined,
      snomed_display: snomedDisplay.trim() || undefined,
    });
    setDescription("");
    setIcdCode("");
    setIcdSearch("");
    setSnomedCode("");
    setSnomedDisplay("");
    setSnomedSearch("");
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

  return (
    <Stack gap="sm">
      {canUpdate && (
        <Stack gap="xs">
          <Group gap="xs" align="flex-end" wrap="nowrap">
            <Autocomplete
              placeholder="Search ICD-10 code..."
              value={icdSearch}
              onChange={(val) => {
                setIcdSearch(val);
                handleIcdSelect(val);
              }}
              data={icdOptions.map((o) => o.value)}
              leftSection={<IconSearch size={14} />}
              w={250}
              size="sm"
              limit={15}
            />
            <Autocomplete
              placeholder="Search SNOMED CT..."
              value={snomedSearch}
              onChange={(val) => {
                setSnomedSearch(val);
                handleSnomedSelect(val);
              }}
              data={snomedOptions.map((o) => o.value)}
              leftSection={<IconSearch size={14} />}
              w={250}
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
              <Badge size="sm" variant="light" color="primary">ICD: {icdCode}</Badge>
            )}
            {snomedCode && (
              <Badge size="sm" variant="light" color="violet">SNOMED: {snomedCode}</Badge>
            )}
            <Select
              data={SEVERITY_OPTIONS}
              value={severity}
              onChange={setSeverity}
              placeholder="Severity"
              w={120}
              size="sm"
            />
            <Select
              data={CERTAINTY_OPTIONS}
              value={certainty}
              onChange={setCertainty}
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
                <Text size="sm" fw={500}>{d.description}</Text>
                {d.is_primary && (
                  <Badge size="xs" color="orange" variant="light">{t("diagnosis.primary")}</Badge>
                )}
              </Group>
              <Group gap={6} mt={4}>
                {d.icd_code && (
                  <Badge size="xs" variant="outline" color="slate">{d.icd_code}</Badge>
                )}
                {d.snomed_code && (
                  <Badge size="xs" variant="outline" color="violet">{d.snomed_code}</Badge>
                )}
                {d.severity && (
                  <Badge size="xs" variant="light" color={SEVERITY_COLORS[d.severity] ?? "slate"}>
                    {d.severity}
                  </Badge>
                )}
                {d.certainty && (
                  <Badge size="xs" variant="dot" color={CERTAINTY_COLORS[d.certainty] ?? "slate"}>
                    {d.certainty}
                  </Badge>
                )}
              </Group>
            </div>
            {canUpdate && (
              <ActionIcon
                variant="subtle"
                color="danger"
                size="sm"
                onClick={() => onDelete(d.id)}
                aria-label="Delete"
              >
                <IconTrash size={14} />
              </ActionIcon>
            )}
          </Group>
        </Card>
      ))}
    </Stack>
  );
}
