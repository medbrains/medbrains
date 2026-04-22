import { api } from "@medbrains/api";
import type { Diagnosis } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
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

// SOAP note sections mapped to backend Consultation fields:
// S (Subjective) → chief_complaint + history
// O (Objective) → examination
// A (Assessment) → notes (clinical impression)
// P (Plan) → plan
type NoteSection = "subjective" | "objective" | "assessment" | "plan";

interface SOAPNote {
  subjective: string; // maps to chief_complaint
  objective: string;  // maps to examination
  assessment: string; // maps to notes
  plan: string;       // maps to plan
}

const SECTION_PROMPTS = {
  subjective: "Patient's symptoms, complaints, and history in their own words...",
  objective: "Physical examination findings, vital signs, lab results...",
  assessment: "Diagnosis, differential diagnosis, clinical impression...",
  plan: "Treatment plan, medications, follow-up, referrals...",
};

const SECTION_ICONS = {
  subjective: "account-voice",
  objective: "stethoscope",
  assessment: "clipboard-text",
  plan: "clipboard-check",
};

export function ConsultationNotesScreen({ route }: ConsultationNotesScreenProps) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const { encounterId } = route.params;

  const [activeSection, setActiveSection] = useState<NoteSection>("subjective");
  const [notes, setNotes] = useState<SOAPNote>({
    subjective: "",
    objective: "",
    assessment: "",
    plan: "",
  });
  const [snackbar, setSnackbar] = useState({ visible: false, message: "" });

  const { data: existingConsultation, isLoading } = useQuery({
    queryKey: ["consultation", encounterId],
    queryFn: () => api.getConsultation(encounterId),
    enabled: Boolean(encounterId),
  });

  const { data: diagnoses } = useQuery({
    queryKey: ["diagnoses", encounterId],
    queryFn: () => api.listDiagnoses(encounterId),
    enabled: Boolean(encounterId),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Map SOAP fields to backend Consultation fields
      const consultationData = {
        chief_complaint: notes.subjective || undefined,
        examination: notes.objective || undefined,
        notes: notes.assessment || undefined,
        plan: notes.plan || undefined,
      };

      if (existingConsultation) {
        // updateConsultation takes (encounterId, consultationId, data)
        await api.updateConsultation(encounterId, existingConsultation.id, consultationData);
      } else {
        // createConsultation takes (encounterId, data)
        await api.createConsultation(encounterId, consultationData);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["consultation"] });
      setSnackbar({ visible: true, message: "Notes saved successfully" });
    },
    onError: () => {
      setSnackbar({ visible: true, message: "Failed to save notes" });
    },
  });

  // Load existing notes from consultation
  React.useEffect(() => {
    if (existingConsultation) {
      setNotes({
        subjective: existingConsultation.chief_complaint || "",
        objective: existingConsultation.examination || "",
        assessment: existingConsultation.notes || "",
        plan: existingConsultation.plan || "",
      });
    }
  }, [existingConsultation]);

  const updateNote = (section: NoteSection, value: string) => {
    setNotes((prev) => ({ ...prev, [section]: value }));
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
            <Text variant="labelMedium">SOAP Note Progress</Text>
            <Text variant="labelLarge" style={styles.progressPercent}>
              {Math.round(getSectionProgress())}%
            </Text>
          </View>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${getSectionProgress()}%` },
              ]}
            />
          </View>
          <View style={styles.sectionIndicators}>
            {(["subjective", "objective", "assessment", "plan"] as NoteSection[]).map((section) => (
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
          onValueChange={(v) => setActiveSection(v as NoteSection)}
          buttons={[
            { value: "subjective", label: "S", icon: SECTION_ICONS.subjective },
            { value: "objective", label: "O", icon: SECTION_ICONS.objective },
            { value: "assessment", label: "A", icon: SECTION_ICONS.assessment },
            { value: "plan", label: "P", icon: SECTION_ICONS.plan },
          ]}
          style={styles.segmented}
        />

        {/* Active Section */}
        <Card style={styles.noteCard}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <Avatar.Icon
                size={32}
                icon={SECTION_ICONS[activeSection]}
                style={styles.sectionIcon}
              />
              <Text variant="titleMedium" style={styles.sectionTitle}>
                {activeSection.charAt(0).toUpperCase() + activeSection.slice(1)}
              </Text>
            </View>

            <TextInput
              mode="outlined"
              multiline
              numberOfLines={8}
              value={notes[activeSection]}
              onChangeText={(v) => updateNote(activeSection, v)}
              placeholder={SECTION_PROMPTS[activeSection]}
              style={styles.noteInput}
            />

            {/* Quick Templates */}
            <View style={styles.templates}>
              <Text variant="labelSmall" style={styles.templatesLabel}>
                Quick phrases:
              </Text>
              <View style={styles.templateChips}>
                {activeSection === "subjective" && (
                  <>
                    <Chip compact onPress={() => updateNote(activeSection, notes[activeSection] + "Patient complains of ")}>
                      Complains of
                    </Chip>
                    <Chip compact onPress={() => updateNote(activeSection, notes[activeSection] + "History of ")}>
                      H/O
                    </Chip>
                    <Chip compact onPress={() => updateNote(activeSection, notes[activeSection] + "No known allergies. ")}>
                      NKA
                    </Chip>
                  </>
                )}
                {activeSection === "objective" && (
                  <>
                    <Chip compact onPress={() => updateNote(activeSection, notes[activeSection] + "On examination: ")}>
                      O/E
                    </Chip>
                    <Chip compact onPress={() => updateNote(activeSection, notes[activeSection] + "Vitals stable. ")}>
                      Vitals stable
                    </Chip>
                    <Chip compact onPress={() => updateNote(activeSection, notes[activeSection] + "No abnormality detected. ")}>
                      NAD
                    </Chip>
                  </>
                )}
                {activeSection === "assessment" && (
                  <>
                    <Chip compact onPress={() => updateNote(activeSection, notes[activeSection] + "Primary diagnosis: ")}>
                      Dx
                    </Chip>
                    <Chip compact onPress={() => updateNote(activeSection, notes[activeSection] + "Rule out ")}>
                      R/O
                    </Chip>
                    <Chip compact onPress={() => updateNote(activeSection, notes[activeSection] + "Stable condition. ")}>
                      Stable
                    </Chip>
                  </>
                )}
                {activeSection === "plan" && (
                  <>
                    <Chip compact onPress={() => updateNote(activeSection, notes[activeSection] + "Continue current medications. ")}>
                      Continue meds
                    </Chip>
                    <Chip compact onPress={() => updateNote(activeSection, notes[activeSection] + "Review after 1 week. ")}>
                      Review 1w
                    </Chip>
                    <Chip compact onPress={() => updateNote(activeSection, notes[activeSection] + "Advised rest and hydration. ")}>
                      Rest advised
                    </Chip>
                  </>
                )}
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Active Diagnoses */}
        {diagnosisList.length > 0 && (
          <Card style={styles.diagnosesCard}>
            <Card.Content>
              <Text variant="titleSmall" style={styles.diagnosesTitle}>
                Active Diagnoses
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
          onPress={() => saveMutation.mutate()}
          loading={saveMutation.isPending}
          disabled={!hasContent || saveMutation.isPending}
          style={styles.saveButton}
          contentStyle={styles.saveButtonContent}
          icon="content-save"
        >
          Save Notes
        </Button>

        {/* Complete & Sign Button */}
        {hasContent && (
          <Button
            mode="outlined"
            onPress={() => {
              saveMutation.mutate();
              // Additional sign-off logic could navigate back after save
            }}
            style={styles.signButton}
            icon="check-decagram"
          >
            Complete & Sign
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
    color: "#228be6",
  },
  progressBar: {
    height: 8,
    backgroundColor: "#e9ecef",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#228be6",
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
    backgroundColor: "#40c057",
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
