import { zodResolver } from "@hookform/resolvers/zod";
import {
  type MobileConsultationNotesFormInput,
  mobileConsultationNotesFormSchema,
} from "@medbrains/schemas";
import type { Diagnosis } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Avatar,
  Button,
  Card,
  Chip,
  Divider,
  SegmentedButtons,
  Snackbar,
  Surface,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  MOBILE_CONSULTATION_NOTES_TEXT,
  mobilePatientJourneyText,
} from "../../components/patientJourneyText";
import { clinicalService } from "../../services/clinical.service";

interface ConsultationNotesScreenProps {
  route: {
    params: {
      encounterId: string;
      patientId?: string;
    };
  };
  navigation: {
    goBack: () => void;
  };
}

type NoteSection = keyof MobileConsultationNotesFormInput;
type NoteSectionConfig = {
  icon: string;
  labelKey: string;
  placeholderKey: string;
  shortLabelKey: string;
};
type NoteTemplate = {
  labelKey: string;
  snippetKey: string;
};

const NOTE_SECTIONS: NoteSection[] = ["subjective", "objective", "assessment", "plan"];
const CONSULTATION_TEXT = MOBILE_CONSULTATION_NOTES_TEXT;

const EMPTY_CONSULTATION_NOTES_FORM: MobileConsultationNotesFormInput = {
  subjective: "",
  objective: "",
  assessment: "",
  plan: "",
};

const NOTE_SECTION_CONFIGS: Record<NoteSection, NoteSectionConfig> = {
  subjective: {
    icon: "account-voice",
    labelKey: CONSULTATION_TEXT.sections.subjective,
    placeholderKey: CONSULTATION_TEXT.placeholders.subjective,
    shortLabelKey: CONSULTATION_TEXT.sections.subjectiveShort,
  },
  objective: {
    icon: "stethoscope",
    labelKey: CONSULTATION_TEXT.sections.objective,
    placeholderKey: CONSULTATION_TEXT.placeholders.objective,
    shortLabelKey: CONSULTATION_TEXT.sections.objectiveShort,
  },
  assessment: {
    icon: "clipboard-text",
    labelKey: CONSULTATION_TEXT.sections.assessment,
    placeholderKey: CONSULTATION_TEXT.placeholders.assessment,
    shortLabelKey: CONSULTATION_TEXT.sections.assessmentShort,
  },
  plan: {
    icon: "clipboard-check",
    labelKey: CONSULTATION_TEXT.sections.plan,
    placeholderKey: CONSULTATION_TEXT.placeholders.plan,
    shortLabelKey: CONSULTATION_TEXT.sections.planShort,
  },
};

const NOTE_TEMPLATES: Record<NoteSection, readonly NoteTemplate[]> = {
  subjective: [
    {
      labelKey: CONSULTATION_TEXT.templates.complainsOf,
      snippetKey: CONSULTATION_TEXT.templates.complainsOfSnippet,
    },
    {
      labelKey: CONSULTATION_TEXT.templates.historyOf,
      snippetKey: CONSULTATION_TEXT.templates.historyOfSnippet,
    },
    {
      labelKey: CONSULTATION_TEXT.templates.noKnownAllergies,
      snippetKey: CONSULTATION_TEXT.templates.noKnownAllergiesSnippet,
    },
  ],
  objective: [
    {
      labelKey: CONSULTATION_TEXT.templates.onExamination,
      snippetKey: CONSULTATION_TEXT.templates.onExaminationSnippet,
    },
    {
      labelKey: CONSULTATION_TEXT.templates.vitalsStable,
      snippetKey: CONSULTATION_TEXT.templates.vitalsStableSnippet,
    },
    {
      labelKey: CONSULTATION_TEXT.templates.noAbnormality,
      snippetKey: CONSULTATION_TEXT.templates.noAbnormalitySnippet,
    },
  ],
  assessment: [
    {
      labelKey: CONSULTATION_TEXT.templates.diagnosis,
      snippetKey: CONSULTATION_TEXT.templates.diagnosisSnippet,
    },
    {
      labelKey: CONSULTATION_TEXT.templates.ruleOut,
      snippetKey: CONSULTATION_TEXT.templates.ruleOutSnippet,
    },
    {
      labelKey: CONSULTATION_TEXT.templates.stableCondition,
      snippetKey: CONSULTATION_TEXT.templates.stableConditionSnippet,
    },
  ],
  plan: [
    {
      labelKey: CONSULTATION_TEXT.templates.continueMeds,
      snippetKey: CONSULTATION_TEXT.templates.continueMedsSnippet,
    },
    {
      labelKey: CONSULTATION_TEXT.templates.reviewOneWeek,
      snippetKey: CONSULTATION_TEXT.templates.reviewOneWeekSnippet,
    },
    {
      labelKey: CONSULTATION_TEXT.templates.restAdvised,
      snippetKey: CONSULTATION_TEXT.templates.restAdvisedSnippet,
    },
  ],
};

function consultationText(key: string): string {
  return mobilePatientJourneyText(key);
}

export function ConsultationNotesScreen({ route }: ConsultationNotesScreenProps) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const { encounterId } = route.params;

  const [activeSection, setActiveSection] = useState<NoteSection>("subjective");
  const [snackbar, setSnackbar] = useState({ visible: false, message: "" });

  const { data: existingConsultation, isLoading } = useQuery({
    queryKey: ["consultation", encounterId],
    queryFn: () => clinicalService.getConsultation(encounterId),
    enabled: Boolean(encounterId),
  });

  const { data: diagnoses } = useQuery({
    queryKey: ["diagnoses", encounterId],
    queryFn: () => clinicalService.listDiagnoses(encounterId),
    enabled: Boolean(encounterId),
  });

  const consultationValues = useMemo<MobileConsultationNotesFormInput>(
    () =>
      existingConsultation
        ? {
            subjective: existingConsultation.chief_complaint || "",
            objective: existingConsultation.examination || "",
            assessment: existingConsultation.notes || "",
            plan: existingConsultation.plan || "",
          }
        : EMPTY_CONSULTATION_NOTES_FORM,
    [existingConsultation],
  );

  const { control, handleSubmit, setValue, watch } = useForm<MobileConsultationNotesFormInput>({
    resolver: zodResolver(mobileConsultationNotesFormSchema),
    values: consultationValues,
  });
  const notes = watch();

  const saveMutation = useMutation({
    mutationFn: async (values: MobileConsultationNotesFormInput) => {
      const consultationData = {
        chief_complaint: values.subjective.trim() || undefined,
        examination: values.objective.trim() || undefined,
        notes: values.assessment.trim() || undefined,
        plan: values.plan.trim() || undefined,
      };

      if (existingConsultation) {
        await clinicalService.updateConsultation(
          encounterId,
          existingConsultation.id,
          consultationData,
        );
      } else {
        await clinicalService.createConsultation(encounterId, consultationData);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["consultation"] });
      setSnackbar({ visible: true, message: consultationText(CONSULTATION_TEXT.status.saved) });
    },
    onError: () => {
      setSnackbar({
        visible: true,
        message: consultationText(CONSULTATION_TEXT.errors.failedToSave),
      });
    },
  });

  const submitNotes = handleSubmit((values) => saveMutation.mutate(values));

  const updateNote = (section: NoteSection, value: string) => {
    setValue(section, value, { shouldDirty: true, shouldValidate: true });
  };

  const appendTemplate = (section: NoteSection, snippetKey: string) => {
    const current = notes[section];
    const snippet = consultationText(snippetKey);
    const separator = current.trim().length > 0 && !current.endsWith(" ") ? " " : "";
    updateNote(section, `${current}${separator}${snippet} `);
  };

  const getSectionProgress = (): number => {
    const filled = Object.values(notes).filter((v) => v.trim().length > 0).length;
    return (filled / 4) * 100;
  };

  const hasContent = Object.values(notes).some((v) => v.trim().length > 0);

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  const diagnosisList: Diagnosis[] = diagnoses || [];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Progress Indicator */}
        <Surface style={styles.progressCard} elevation={1}>
          <View style={styles.progressHeader}>
            <Text variant="labelMedium">{consultationText(CONSULTATION_TEXT.progress.soap)}</Text>
            <Text variant="labelLarge" style={styles.progressPercent}>
              {Math.round(getSectionProgress())}%
            </Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${getSectionProgress()}%` }]} />
          </View>
          <View style={styles.sectionIndicators}>
            {NOTE_SECTIONS.map((section) => (
              <View
                key={section}
                style={[
                  styles.sectionDot,
                  notes[section].trim().length > 0 && styles.sectionDotFilled,
                ]}
              />
            ))}
          </View>
        </Surface>

        {/* Section Tabs */}
        <SegmentedButtons
          value={activeSection}
          onValueChange={(value) => {
            const nextSection = NOTE_SECTIONS.find((section) => section === value);
            if (nextSection) {
              setActiveSection(nextSection);
            }
          }}
          buttons={NOTE_SECTIONS.map((section) => ({
            value: section,
            label: consultationText(NOTE_SECTION_CONFIGS[section].shortLabelKey),
            icon: NOTE_SECTION_CONFIGS[section].icon,
          }))}
          style={styles.segmented}
        />

        {/* Active Section */}
        <Card style={styles.noteCard}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <Avatar.Icon
                size={32}
                icon={NOTE_SECTION_CONFIGS[activeSection].icon}
                style={styles.sectionIcon}
              />
              <Text variant="titleMedium" style={styles.sectionTitle}>
                {consultationText(NOTE_SECTION_CONFIGS[activeSection].labelKey)}
              </Text>
            </View>

            <Controller
              control={control}
              name={activeSection}
              render={({ field }) => (
                <TextInput
                  mode="outlined"
                  multiline
                  numberOfLines={8}
                  value={field.value}
                  onChangeText={field.onChange}
                  placeholder={consultationText(NOTE_SECTION_CONFIGS[activeSection].placeholderKey)}
                  style={styles.noteInput}
                />
              )}
            />

            {/* Quick Templates */}
            <View style={styles.templates}>
              <Text variant="labelSmall" style={styles.templatesLabel}>
                {consultationText(CONSULTATION_TEXT.templates.quickPhrases)}
              </Text>
              <View style={styles.templateChips}>
                {NOTE_TEMPLATES[activeSection].map((template) => (
                  <Chip
                    key={template.labelKey}
                    compact
                    onPress={() => appendTemplate(activeSection, template.snippetKey)}
                  >
                    {consultationText(template.labelKey)}
                  </Chip>
                ))}
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Active Diagnoses */}
        {diagnosisList.length > 0 && (
          <Card style={styles.diagnosesCard}>
            <Card.Content>
              <Text variant="titleSmall" style={styles.diagnosesTitle}>
                {consultationText(CONSULTATION_TEXT.diagnoses.active)}
              </Text>
              <Divider style={styles.divider} />
              <View style={styles.diagnosisChips}>
                {diagnosisList.map((dx) => (
                  <Chip key={dx.id} icon="medical-bag" style={styles.diagnosisChip}>
                    {dx.description}
                    {dx.icd_code && ` (${dx.icd_code})`}
                  </Chip>
                ))}
              </View>
            </Card.Content>
          </Card>
        )}

        {/* Save Button */}
        <Button
          mode="contained"
          onPress={() => void submitNotes()}
          loading={saveMutation.isPending}
          disabled={!hasContent || saveMutation.isPending}
          style={styles.saveButton}
          contentStyle={styles.saveButtonContent}
          icon="content-save"
        >
          {consultationText(CONSULTATION_TEXT.actions.save)}
        </Button>

        {/* Complete & Sign Button */}
        {hasContent && (
          <Button
            mode="outlined"
            onPress={() => {
              void submitNotes();
            }}
            style={styles.signButton}
            icon="check-decagram"
          >
            {consultationText(CONSULTATION_TEXT.actions.completeSign)}
          </Button>
        )}
      </ScrollView>

      <Snackbar
        visible={snackbar.visible}
        onDismiss={() => setSnackbar({ ...snackbar, visible: false })}
        duration={3000}
      >
        {snackbar.message}
      </Snackbar>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  progressCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  progressPercent: {
    fontWeight: "bold",
    color: "#0F766E",
  },
  progressBar: {
    height: 8,
    backgroundColor: "#e9ecef",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#0F766E",
    borderRadius: 4,
  },
  sectionIndicators: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
    paddingHorizontal: 4,
  },
  sectionDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#dee2e6",
  },
  sectionDotFilled: {
    backgroundColor: "#10b981",
  },
  segmented: {
    marginBottom: 16,
  },
  noteCard: {
    borderRadius: 12,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  sectionIcon: {
    backgroundColor: "#e7f5ff",
  },
  sectionTitle: {
    fontWeight: "600",
  },
  noteInput: {
    minHeight: 150,
  },
  templates: {
    marginTop: 12,
  },
  templatesLabel: {
    opacity: 0.6,
    marginBottom: 8,
  },
  templateChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  diagnosesCard: {
    borderRadius: 12,
    backgroundColor: "#f8f9fa",
    marginBottom: 16,
  },
  diagnosesTitle: {
    fontWeight: "600",
    opacity: 0.7,
  },
  divider: {
    marginVertical: 8,
  },
  diagnosisChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  diagnosisChip: {
    backgroundColor: "#e7f5ff",
  },
  saveButton: {
    borderRadius: 12,
    marginBottom: 12,
  },
  saveButtonContent: {
    paddingVertical: 8,
  },
  signButton: {
    borderRadius: 12,
  },
});
