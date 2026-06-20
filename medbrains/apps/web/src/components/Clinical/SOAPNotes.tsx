import { zodResolver } from "@hookform/resolvers/zod";
import {
  Badge,
  Button,
  Card,
  Divider,
  Group,
  Modal,
  ScrollArea,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  ThemeIcon,
  Timeline,
  UnstyledButton,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { type SoapNoteFormInput, soapNoteFormSchema } from "@medbrains/schemas";
import { useFieldAccess, useHasPermission } from "@medbrains/stores";
import {
  type ClinicalCorpusEntry,
  type Consultation,
  type CreateConsultationRequest,
  P,
  type PatientConsultationHistoryRow,
  type UpdateConsultationRequest,
} from "@medbrains/types";
import { fieldAccessText } from "@medbrains/utils";
import {
  IconBrain,
  IconCalendarStats,
  IconClipboardList,
  IconEye,
  IconHistory,
  IconMessage,
  IconPlus,
  IconStethoscope,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { RichTextEditor } from "@/components/ui";
import {
  type SoapKeywordSuggestion,
  type SoapSectionKey,
  searchSoapKeywordSuggestions,
} from "@/domain/clinical/soap-corpus";
import {
  buildCombinedSoapNote,
  DEFAULT_SOAP_NOTE_FORM_VALUES,
  soapNoteDefaultsFromConsultation,
  toSoapNoteRequest,
} from "@/forms/soap-note.form";
import { usePacedQueryValue } from "@/hooks/usePacedQueryValue";
import { clinicalSupportService } from "@/services/clinicalSupport.service";
import styles from "./soap-notes.module.scss";

interface SoapSection {
  key: SoapSectionKey;
  letter: string;
  labelKey: string;
  fullLabelKey: string;
  color: string;
  icon: ReactNode;
  placeholderKey: string;
  formatHint: string;
  timelineEmpty: string;
}

interface SoapTimelineEntry {
  id: string;
  date: string;
  title: string;
  subtitle: string;
  status: string;
  value: string;
}

interface SoapCalendarEntry {
  id: string;
  date: string;
  title: string;
  subtitle: string;
  status: string;
  sections: string[];
  preview: string;
}

interface SoapSectionTimeline {
  section: SoapSection;
  entries: SoapTimelineEntry[];
}

const SOAP_SECTIONS: SoapSection[] = [
  {
    key: "chief_complaint",
    letter: "S",
    labelKey: "soap.subjective",
    fullLabelKey: "soap.chiefComplaint",
    color: "blue",
    icon: <IconMessage size={16} />,
    placeholderKey: "soap.placeholderSubjective",
    formatHint:
      "Date, time, provider, chief concern, HPI, ROS, PMH, current medicines, allergies, social and family history.",
    timelineEmpty: "No prior subjective note has been captured.",
  },
  {
    key: "examination",
    letter: "O",
    labelKey: "soap.objective",
    fullLabelKey: "soap.examination",
    color: "teal",
    icon: <IconEye size={16} />,
    placeholderKey: "soap.placeholderObjective",
    formatHint:
      "Vitals, general appearance, system examination, focused findings, reviewed labs and imaging.",
    timelineEmpty: "No prior objective note has been captured.",
  },
  {
    key: "history",
    letter: "A",
    labelKey: "soap.assessment",
    fullLabelKey: "soap.clinicalAssessment",
    color: "violet",
    icon: <IconBrain size={16} />,
    placeholderKey: "soap.placeholderAssessment",
    formatHint: "Clinical impression, problem list, diagnosis, differential, severity and risk.",
    timelineEmpty: "No prior assessment note has been captured.",
  },
  {
    key: "plan",
    letter: "P",
    labelKey: "soap.plan",
    fullLabelKey: "soap.treatmentPlan",
    color: "green",
    icon: <IconClipboardList size={16} />,
    placeholderKey: "soap.placeholderPlan",
    formatHint: "Labs, imaging, medications, patient education, safety advice and follow-up.",
    timelineEmpty: "No prior plan note has been captured.",
  },
];

interface SOAPNotesProps {
  onSubmit: (data: CreateConsultationRequest | UpdateConsultationRequest) => void;
  defaultValues?: Partial<Consultation>;
  editorDefaultValues?: Partial<Consultation>;
  historyNotes?: PatientConsultationHistoryRow[];
  isHistoryLoading?: boolean;
  isSubmitting?: boolean;
  submitLabel?: string;
  readOnly?: boolean;
}

function normalizeSoapValues(values: Partial<SoapNoteFormInput>): SoapNoteFormInput {
  return {
    chief_complaint: values.chief_complaint ?? "",
    examination: values.examination ?? "",
    history: values.history ?? "",
    plan: values.plan ?? "",
    notes: values.notes ?? "",
  };
}

function textValue(value: string | null | undefined): string {
  if (!value) return "";
  // Notes are now rich-text HTML — strip tags for plain-text previews/timeline.
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatNoteDate(value: string | null | undefined): string {
  if (!value) return "Unsaved";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatEncounterDate(value: string | null | undefined): string {
  if (!value) return "No date";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString([], {
    dateStyle: "medium",
  });
}

function getHistorySectionValue(note: PatientConsultationHistoryRow, key: SoapSectionKey): string {
  if (key === "chief_complaint") return textValue(note.chief_complaint);
  if (key === "examination") return textValue(note.examination);
  if (key === "history") return textValue(note.history);
  return textValue(note.plan);
}

function hasHistoryContent(note: PatientConsultationHistoryRow): boolean {
  return SOAP_SECTIONS.some((section) => getHistorySectionValue(note, section.key).length > 0);
}

function noteTitle(note: PatientConsultationHistoryRow): string {
  return `${note.encounter_type.toUpperCase()} visit - ${formatEncounterDate(note.encounter_date)}`;
}

function noteSubtitle(note: PatientConsultationHistoryRow): string {
  return [note.department_name, note.doctor_name ? `Dr. ${note.doctor_name}` : null]
    .filter(Boolean)
    .join(" - ");
}

function buildSectionTimelines(
  historyNotes: PatientConsultationHistoryRow[],
): SoapSectionTimeline[] {
  return SOAP_SECTIONS.map((section) => {
    const entries = historyNotes.reduce<SoapTimelineEntry[]>((acc, note) => {
      const value = getHistorySectionValue(note, section.key);
      if (value.length > 0) {
        acc.push({
          id: note.id,
          date: formatNoteDate(note.updated_at ?? note.created_at),
          title: noteTitle(note),
          subtitle: noteSubtitle(note),
          status: note.status,
          value,
        });
      }
      return acc;
    }, []);

    return { section, entries };
  });
}

function buildCalendarEntries(historyNotes: PatientConsultationHistoryRow[]): SoapCalendarEntry[] {
  return historyNotes.filter(hasHistoryContent).map((note) => {
    const sections = SOAP_SECTIONS.filter(
      (section) => getHistorySectionValue(note, section.key).length > 0,
    ).map((section) => section.letter);
    const preview = SOAP_SECTIONS.map((section) => getHistorySectionValue(note, section.key))
      .find((value) => value.length > 0)
      ?.slice(0, 180);
    return {
      id: note.id,
      date: formatEncounterDate(note.encounter_date),
      title: noteTitle(note),
      subtitle: noteSubtitle(note),
      status: note.status,
      sections,
      preview: preview ?? "",
    };
  });
}

function getActiveToken(value: string): string {
  const match = value.match(/([a-zA-Z][a-zA-Z-]*)$/);
  return match?.[1]?.toLowerCase() ?? "";
}

function getKeywordSuggestions(
  sectionKey: SoapSectionKey,
  value: string,
  corpusEntries: ClinicalCorpusEntry[],
): SoapKeywordSuggestion[] {
  const token = getActiveToken(value);
  if (token.length < 2) return [];

  return uniqueKeywordSuggestions([
    ...corpusEntries.map((entry) => corpusEntryToKeywordSuggestion(sectionKey, entry)),
    ...searchSoapKeywordSuggestions(sectionKey, token),
  ]).slice(0, 6);
}

function corpusEntryToKeywordSuggestion(
  sectionKey: SoapSectionKey,
  entry: ClinicalCorpusEntry,
): SoapKeywordSuggestion {
  const label = entry.term.trim();
  return {
    id: entry.id,
    section: sectionKey,
    label,
    keywords: [label, ...entry.aliases].map((keyword) => keyword.toLowerCase()),
    text: entry.insert_text?.trim() || label,
    hint: entry.short_text?.trim() || entry.source_name,
    source: entry.source_name,
  };
}

function uniqueKeywordSuggestions(suggestions: SoapKeywordSuggestion[]): SoapKeywordSuggestion[] {
  const seen = new Set<string>();
  return suggestions.filter((suggestion) => {
    const key = `${suggestion.label}:${suggestion.text}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function applyKeywordSuggestionToText(value: string, suggestion: SoapKeywordSuggestion): string {
  const token = getActiveToken(value);
  if (token.length === 0)
    return value.length > 0 ? `${value}\n${suggestion.text}` : suggestion.text;
  const prefix = value.slice(0, value.length - token.length).trimEnd();
  return prefix.length > 0 ? `${prefix}\n${suggestion.text}` : suggestion.text;
}

function KeywordSuggestions({
  suggestions,
  sectionKey,
  value,
  onAccept,
}: {
  suggestions: SoapKeywordSuggestion[];
  sectionKey: SoapSectionKey;
  value: string;
  onAccept: (key: SoapSectionKey, nextValue: string) => void;
}) {
  if (suggestions.length === 0) return null;

  return (
    <div className={styles.keywordSuggestions}>
      {suggestions.map((suggestion) => (
        <UnstyledButton
          key={suggestion.id}
          className={styles.keywordSuggestion}
          onClick={() => onAccept(sectionKey, applyKeywordSuggestionToText(value, suggestion))}
        >
          <Text size="xs" fw={700}>
            {suggestion.label}
          </Text>
          <Text size="xs" c="dimmed">
            {suggestion.hint}
          </Text>
        </UnstyledButton>
      ))}
    </div>
  );
}

export function SOAPNotes({
  onSubmit,
  defaultValues,
  editorDefaultValues,
  historyNotes = [],
  isHistoryLoading,
  isSubmitting,
  submitLabel,
  readOnly,
}: SOAPNotesProps) {
  const { t } = useTranslation("clinical");
  const hasSoapWritePermission = useHasPermission(P.OPD.VISIT_UPDATE);
  const soapNoteAccess = useFieldAccess("opd.soap_note");
  const canEditSoap = !readOnly && hasSoapWritePermission && soapNoteAccess === "edit";
  const canShowSoapText = soapNoteAccess !== "hidden";
  const soapText = (value: string | null | undefined) => fieldAccessText(soapNoteAccess, value);
  const [editorOpened, { open: openEditor, close: closeEditor }] = useDisclosure(false);
  const savedValues = useMemo(
    () => soapNoteDefaultsFromConsultation(defaultValues),
    [defaultValues],
  );
  const editorValues = useMemo(
    () =>
      editorDefaultValues
        ? soapNoteDefaultsFromConsultation(editorDefaultValues)
        : DEFAULT_SOAP_NOTE_FORM_VALUES,
    [editorDefaultValues],
  );
  const form = useForm<SoapNoteFormInput>({
    resolver: zodResolver(soapNoteFormSchema),
    defaultValues: editorValues,
  });
  const watched = useWatch({ control: form.control });
  const watchedValues = normalizeSoapValues(watched);
  const subjectiveToken = usePacedQueryValue(getActiveToken(watchedValues.chief_complaint), 250);
  const objectiveToken = usePacedQueryValue(getActiveToken(watchedValues.examination), 250);
  const assessmentToken = usePacedQueryValue(getActiveToken(watchedValues.history), 250);
  const planToken = usePacedQueryValue(getActiveToken(watchedValues.plan), 250);
  const subjectiveCorpusQuery = useQuery({
    queryKey: ["clinical-corpus", "soap_phrase", "chief_complaint", subjectiveToken],
    queryFn: () =>
      clinicalSupportService.searchClinicalCorpus({
        q: subjectiveToken,
        section: "chief_complaint",
        corpus_type: "soap_phrase",
        limit: 8,
      }),
    enabled: canEditSoap && subjectiveToken.length >= 2,
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
  const objectiveCorpusQuery = useQuery({
    queryKey: ["clinical-corpus", "soap_phrase", "examination", objectiveToken],
    queryFn: () =>
      clinicalSupportService.searchClinicalCorpus({
        q: objectiveToken,
        section: "examination",
        corpus_type: "soap_phrase",
        limit: 8,
      }),
    enabled: canEditSoap && objectiveToken.length >= 2,
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
  const assessmentCorpusQuery = useQuery({
    queryKey: ["clinical-corpus", "soap_phrase", "history", assessmentToken],
    queryFn: () =>
      clinicalSupportService.searchClinicalCorpus({
        q: assessmentToken,
        section: "history",
        corpus_type: "soap_phrase",
        limit: 8,
      }),
    enabled: canEditSoap && assessmentToken.length >= 2,
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
  const planCorpusQuery = useQuery({
    queryKey: ["clinical-corpus", "soap_phrase", "plan", planToken],
    queryFn: () =>
      clinicalSupportService.searchClinicalCorpus({
        q: planToken,
        section: "plan",
        corpus_type: "soap_phrase",
        limit: 8,
      }),
    enabled: canEditSoap && planToken.length >= 2,
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
  const corpusEntries = useMemo(
    () => ({
      chief_complaint: subjectiveCorpusQuery.data ?? [],
      examination: objectiveCorpusQuery.data ?? [],
      history: assessmentCorpusQuery.data ?? [],
      plan: planCorpusQuery.data ?? [],
    }),
    [
      assessmentCorpusQuery.data,
      objectiveCorpusQuery.data,
      planCorpusQuery.data,
      subjectiveCorpusQuery.data,
    ],
  );
  const hasSavedRecord = Boolean(defaultValues?.id);
  const noteDate = formatNoteDate(defaultValues?.updated_at ?? defaultValues?.created_at);
  const savedSections = SOAP_SECTIONS.map((section) => ({
    ...section,
    value: savedValues[section.key].trim(),
  })).filter((section) => section.value.length > 0);
  const savedCombined =
    savedValues.notes.trim().length > 0
      ? savedValues.notes.trim()
      : buildCombinedSoapNote(savedValues);
  const combinedPreview = buildCombinedSoapNote(watchedValues);
  const hasVisibleNote = savedCombined.length > 0 || savedSections.length > 0;
  const sectionTimelines = useMemo(
    () => buildSectionTimelines(canShowSoapText ? historyNotes : []),
    [canShowSoapText, historyNotes],
  );
  const calendarEntries = useMemo(
    () => buildCalendarEntries(canShowSoapText ? historyNotes : []),
    [canShowSoapText, historyNotes],
  );

  function acceptKeywordSuggestion(key: SoapSectionKey, nextValue: string) {
    if (!canEditSoap) return;
    form.setValue(key, nextValue, { shouldDirty: true, shouldValidate: true });
  }

  function combineSections() {
    if (!canEditSoap) return;
    form.setValue("notes", buildCombinedSoapNote(form.getValues()), {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  function handleCloseEditor() {
    form.reset(editorValues);
    closeEditor();
  }

  function handleSubmit(values: SoapNoteFormInput) {
    if (!canEditSoap) return;
    onSubmit(toSoapNoteRequest(values));
    form.reset(editorValues);
    closeEditor();
  }

  const label = submitLabel ?? "Save note";

  return (
    <Stack gap="sm">
      <Card withBorder radius="md" className={styles.noteShell}>
        <Group justify="space-between" align="flex-start" gap="md">
          <div>
            <Group gap="xs" mb={4}>
              <Text fw={700} size="sm">
                Encounter SOAP note
              </Text>
              <Badge size="xs" color={hasSavedRecord ? "green" : "gray"} variant="light">
                {hasSavedRecord ? "Saved" : "Draft"}
              </Badge>
              <Badge size="xs" color="blue">
                {calendarEntries.length} timeline
              </Badge>
            </Group>
            <Text size="xs" c="dimmed">
              {noteDate}
            </Text>
          </div>
          {canEditSoap && (
            <Button
              size="xs"
              variant={hasVisibleNote ? "light" : "filled"}
              leftSection={<IconPlus size={14} />}
              onClick={openEditor}
            >
              Add note
            </Button>
          )}
        </Group>

        <Divider my="sm" />

        {hasVisibleNote ? (
          <Stack gap="md">
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="xs">
              {SOAP_SECTIONS.map((section) => {
                const value = savedValues[section.key].trim();
                return (
                  <div
                    key={section.key}
                    className={styles.sectionSummary}
                    style={{
                      borderTopColor: `var(--mantine-color-${section.color}-5)`,
                    }}
                  >
                    <Group gap={8} mb={6}>
                      <ThemeIcon variant="light" color={section.color} size={26} radius="xl">
                        <Text size="xs" fw={800}>
                          {section.letter}
                        </Text>
                      </ThemeIcon>
                      <Text size="sm" fw={700}>
                        {t(section.labelKey)}
                      </Text>
                    </Group>
                    <Text size="sm" c={value.length > 0 ? undefined : "dimmed"} lineClamp={6}>
                      {value.length > 0 ? soapText(value) : "Not documented in this encounter."}
                    </Text>
                  </div>
                );
              })}
            </SimpleGrid>

            {savedCombined.length > 0 && (
              <div className={styles.combinedNote}>
                <Text size="xs" fw={700} c="dimmed" tt="uppercase">
                  Combined Note
                </Text>
                <Text size="sm" className={styles.noteText}>
                  {soapText(savedCombined)}
                </Text>
              </div>
            )}
          </Stack>
        ) : (
          <Text size="sm" c="dimmed">
            No SOAP note captured for this encounter.
          </Text>
        )}
      </Card>

      <Card withBorder radius="md" className={styles.noteShell}>
        <Group justify="space-between" mb="sm">
          <Group gap="xs">
            <IconCalendarStats size={16} />
            <Text size="sm" fw={700}>
              SOAP section timeline
            </Text>
          </Group>
          {isHistoryLoading && (
            <Text size="xs" c="dimmed">
              Loading prior notes...
            </Text>
          )}
        </Group>
        <Tabs defaultValue="chief_complaint">
          <Tabs.List>
            {SOAP_SECTIONS.map((section) => (
              <Tabs.Tab key={section.key} value={section.key} leftSection={section.icon}>
                {section.letter}
              </Tabs.Tab>
            ))}
          </Tabs.List>

          {sectionTimelines.map(({ section, entries }) => (
            <Tabs.Panel key={section.key} value={section.key} pt="sm">
              {entries.length > 0 ? (
                <Timeline active={-1} bulletSize={28} lineWidth={2}>
                  {entries.map((entry) => (
                    <Timeline.Item
                      key={`${section.key}-${entry.id}`}
                      color={section.color}
                      bullet={section.icon}
                      title={
                        <Group gap={8}>
                          <Text size="sm" fw={700}>
                            {entry.title}
                          </Text>
                          <Badge size="xs" color="gray">
                            {entry.status}
                          </Badge>
                        </Group>
                      }
                    >
                      <Text size="xs" c="dimmed" mb={4}>
                        {[entry.date, entry.subtitle].filter(Boolean).join(" - ")}
                      </Text>
                      <Text size="sm" className={styles.noteText}>
                        {soapText(entry.value)}
                      </Text>
                    </Timeline.Item>
                  ))}
                </Timeline>
              ) : (
                <Text size="sm" c="dimmed">
                  {section.timelineEmpty}
                </Text>
              )}
            </Tabs.Panel>
          ))}
        </Tabs>
      </Card>

      <Modal
        opened={editorOpened && canEditSoap}
        onClose={handleCloseEditor}
        title="Add SOAP note"
        fullScreen
        classNames={{ body: styles.drawerBody }}
      >
        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <div className={styles.editorGrid}>
            <Stack gap="sm" className={styles.editorSide}>
              <div className={styles.historyPanel}>
                <Group gap="xs" mb="xs">
                  <IconHistory size={16} />
                  <Text size="sm" fw={700}>
                    Note timeline
                  </Text>
                </Group>
                <ScrollArea.Autosize mah={360}>
                  <Stack gap="xs">
                    {calendarEntries.length > 0 ? (
                      calendarEntries.map((entry) => (
                        <div key={entry.id} className={styles.historyItem}>
                          <Group justify="space-between" gap="xs" align="flex-start">
                            <div>
                              <Text size="xs" fw={700}>
                                {entry.date}
                              </Text>
                              <Text size="xs" c="dimmed">
                                {entry.subtitle || entry.title}
                              </Text>
                            </div>
                            <Badge size="xs" color="gray" variant="light">
                              {entry.status}
                            </Badge>
                          </Group>
                          <Group gap={4} mt={6}>
                            {entry.sections.map((letter) => (
                              <Badge key={`${entry.id}-${letter}`} size="xs">
                                {letter}
                              </Badge>
                            ))}
                          </Group>
                          {entry.preview.length > 0 && (
                            <Text size="xs" mt={6} lineClamp={3}>
                              {soapText(entry.preview)}
                            </Text>
                          )}
                        </div>
                      ))
                    ) : (
                      <Text size="sm" c="dimmed">
                        {canShowSoapText
                          ? "No SOAP note entries found for this patient."
                          : "SOAP timeline is restricted by field policy."}
                      </Text>
                    )}
                  </Stack>
                </ScrollArea.Autosize>
              </div>
            </Stack>

            <Stack gap="md" className={styles.editorMain}>
              <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xs">
                {SOAP_SECTIONS.map((section) => (
                  <div
                    key={section.key}
                    className={styles.formatTile}
                    style={{
                      borderLeftColor: `var(--mantine-color-${section.color}-5)`,
                    }}
                  >
                    <Group gap={8} align="flex-start">
                      <ThemeIcon variant="filled" color={section.color} size={24} radius="xl">
                        <Text size="xs" fw={800} c="white" lh={1}>
                          {section.letter}
                        </Text>
                      </ThemeIcon>
                      <div>
                        <Text size="sm" fw={700} lh={1.2}>
                          {t(section.labelKey)}
                        </Text>
                        <Text size="xs" c="dimmed" lh={1.25}>
                          {section.formatHint}
                        </Text>
                      </div>
                    </Group>
                  </div>
                ))}
              </SimpleGrid>

              {SOAP_SECTIONS.map((section) => (
                <div
                  key={section.key}
                  className={styles.soapSection}
                  style={{
                    borderLeftColor: `var(--mantine-color-${section.color}-5)`,
                  }}
                >
                  <Group gap={8} mb={6}>
                    <ThemeIcon variant="filled" color={section.color} size={24} radius="xl">
                      <Text size="xs" fw={800} c="white" lh={1}>
                        {section.letter}
                      </Text>
                    </ThemeIcon>
                    <div>
                      <Text size="sm" fw={600} lh={1.2}>
                        {t(section.labelKey)}
                      </Text>
                      <Text size="xs" c="dimmed" lh={1}>
                        {t(section.fullLabelKey)}
                      </Text>
                    </div>
                  </Group>
                  <Controller
                    control={form.control}
                    name={section.key}
                    render={({ field, fieldState }) => (
                      <>
                        <RichTextEditor
                          ariaLabel={t(section.placeholderKey)}
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          minHeight={140}
                        />
                        {fieldState.error?.message && (
                          <Text size="xs" c="var(--mb-support-error, #da1e28)" mt={4}>
                            {fieldState.error.message}
                          </Text>
                        )}
                        <KeywordSuggestions
                          suggestions={getKeywordSuggestions(
                            section.key,
                            field.value ?? "",
                            corpusEntries[section.key],
                          )}
                          sectionKey={section.key}
                          value={field.value ?? ""}
                          onAccept={acceptKeywordSuggestion}
                        />
                      </>
                    )}
                  />
                </div>
              ))}

              <div className={styles.combinedNote}>
                <Group justify="space-between" mb="xs">
                  <Group gap="xs">
                    <IconStethoscope size={16} />
                    <Text size="sm" fw={700}>
                      Combined note
                    </Text>
                  </Group>
                  <Button
                    type="button"
                    size="xs"
                    variant="light"
                    onClick={combineSections}
                    disabled={!canEditSoap}
                  >
                    Combine S/O/A/P
                  </Button>
                </Group>
                <Controller
                  control={form.control}
                  name="notes"
                  render={({ field, fieldState }) => (
                    <>
                      <RichTextEditor
                        ariaLabel="Combined clinical note"
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        minHeight={160}
                      />
                      {fieldState.error?.message && (
                        <Text size="xs" c="var(--mb-support-error, #da1e28)" mt={4}>
                          {fieldState.error.message}
                        </Text>
                      )}
                    </>
                  )}
                />
                {watchedValues.notes.trim().length === 0 && combinedPreview.length > 0 && (
                  <Text size="xs" c="dimmed" mt={6} className={styles.noteText}>
                    {combinedPreview}
                  </Text>
                )}
              </div>

              <Group justify="flex-end" className={styles.editorActions}>
                <Button type="button" variant="default" onClick={handleCloseEditor}>
                  Cancel
                </Button>
                <Button type="submit" loading={isSubmitting} disabled={!canEditSoap}>
                  {label}
                </Button>
              </Group>
            </Stack>
          </div>
        </form>
      </Modal>
    </Stack>
  );
}
