import { zodResolver } from "@hookform/resolvers/zod";
import { type MobileVitalsEntryFormInput, mobileVitalsEntryFormSchema } from "@medbrains/schemas";
import type { Vital } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Avatar,
  Button,
  Card,
  Divider,
  List,
  Snackbar,
  Surface,
  Text,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { VITAL_CONFIGS, VitalInput } from "../../components";
import { clinicalService } from "../../services/clinical.service";

interface VitalsEntryScreenProps {
  route: {
    params: {
      encounterId?: string;
      patientId?: string;
    };
  };
  navigation: {
    goBack: () => void;
  };
}

const initialVitalsEntryFormValues: MobileVitalsEntryFormInput = {
  temperature: "",
  pulse: "",
  systolic: "",
  diastolic: "",
  respiration: "",
  spo2: "",
  weight: "",
  height: "",
  notes: "",
};

function calculateBMI(weight: string, height: string): string {
  const w = Number.parseFloat(weight);
  const h = Number.parseFloat(height) / 100;
  if (w > 0 && h > 0) {
    return (w / (h * h)).toFixed(1);
  }
  return "";
}

function toOptionalNumber(value: string): number | undefined {
  const trimmed = value.trim();
  return trimmed ? Number(trimmed) : undefined;
}

export function VitalsEntryScreen({ route, navigation }: VitalsEntryScreenProps) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const { encounterId } = route.params;

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<MobileVitalsEntryFormInput>({
    resolver: zodResolver(mobileVitalsEntryFormSchema),
    defaultValues: initialVitalsEntryFormValues,
  });
  const [snackbar, setSnackbar] = useState({ visible: false, message: "" });
  const vitals = watch();

  const { data: existingVitals, isLoading } = useQuery({
    queryKey: ["vitals", encounterId],
    queryFn: () => clinicalService.listVitals(encounterId || ""),
    enabled: Boolean(encounterId),
  });

  const saveMutation = useMutation({
    mutationFn: async (values: MobileVitalsEntryFormInput) => {
      if (!encounterId) throw new Error("No encounter ID");

      const data = {
        temperature: toOptionalNumber(values.temperature),
        pulse: toOptionalNumber(values.pulse),
        systolic_bp: toOptionalNumber(values.systolic),
        diastolic_bp: toOptionalNumber(values.diastolic),
        respiratory_rate: toOptionalNumber(values.respiration),
        spo2: toOptionalNumber(values.spo2),
        weight_kg: toOptionalNumber(values.weight),
        height_cm: toOptionalNumber(values.height),
        notes: values.notes.trim() || undefined,
      };

      await clinicalService.createVital(encounterId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vitals"] });
      setSnackbar({ visible: true, message: "Vitals saved successfully" });
      setTimeout(() => navigation.goBack(), 1500);
    },
    onError: () => {
      setSnackbar({ visible: true, message: "Failed to save vitals" });
    },
  });

  const submitVitals = handleSubmit((values) => saveMutation.mutate(values));

  const bmi = calculateBMI(vitals.weight, vitals.height);
  const hasAnyValue = Object.values(vitals).some((v) => v.trim() !== "");

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  // Helper to format vital display
  const formatVitalDisplay = (vital: Vital): string => {
    const parts: string[] = [];
    if (vital.temperature) parts.push(`Temp: ${vital.temperature}°F`);
    if (vital.pulse) parts.push(`Pulse: ${vital.pulse} bpm`);
    if (vital.systolic_bp && vital.diastolic_bp) {
      parts.push(`BP: ${vital.systolic_bp}/${vital.diastolic_bp} mmHg`);
    }
    if (vital.spo2) parts.push(`SpO2: ${vital.spo2}%`);
    return parts.join(" • ") || "Vitals recorded";
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Previous Vitals Summary */}
        {existingVitals && existingVitals.length > 0 && (
          <Card style={styles.previousCard}>
            <Card.Content>
              <Text variant="titleSmall" style={styles.previousTitle}>
                Previous Vitals
              </Text>
              <Divider style={styles.divider} />
              {existingVitals.slice(0, 3).map((vital) => (
                <List.Item
                  key={vital.id}
                  title={new Date(vital.created_at).toLocaleString()}
                  description={formatVitalDisplay(vital)}
                  left={(props) => <List.Icon {...props} icon="history" />}
                  titleStyle={styles.previousItemTitle}
                />
              ))}
            </Card.Content>
          </Card>
        )}

        {/* Vital Signs Section */}
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Vital Signs
        </Text>

        <Controller
          control={control}
          name="temperature"
          render={({ field }) => (
            <VitalInput
              {...VITAL_CONFIGS.temperature}
              value={field.value}
              onChangeText={field.onChange}
              error={errors.temperature?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="pulse"
          render={({ field }) => (
            <VitalInput
              {...VITAL_CONFIGS.pulse}
              value={field.value}
              onChangeText={field.onChange}
              error={errors.pulse?.message}
              required
            />
          )}
        />

        <View style={styles.bpRow}>
          <View style={styles.bpInput}>
            <Controller
              control={control}
              name="systolic"
              render={({ field }) => (
                <VitalInput
                  {...VITAL_CONFIGS.systolic}
                  value={field.value}
                  onChangeText={field.onChange}
                  error={errors.systolic?.message}
                  required
                />
              )}
            />
          </View>
          <View style={styles.bpInput}>
            <Controller
              control={control}
              name="diastolic"
              render={({ field }) => (
                <VitalInput
                  {...VITAL_CONFIGS.diastolic}
                  value={field.value}
                  onChangeText={field.onChange}
                  error={errors.diastolic?.message}
                  required
                />
              )}
            />
          </View>
        </View>

        <Controller
          control={control}
          name="respiration"
          render={({ field }) => (
            <VitalInput
              {...VITAL_CONFIGS.respiration}
              value={field.value}
              onChangeText={field.onChange}
              error={errors.respiration?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="spo2"
          render={({ field }) => (
            <VitalInput
              {...VITAL_CONFIGS.spo2}
              value={field.value}
              onChangeText={field.onChange}
              error={errors.spo2?.message}
            />
          )}
        />

        {/* Anthropometry Section */}
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Anthropometry
        </Text>

        <View style={styles.bpRow}>
          <View style={styles.bpInput}>
            <Controller
              control={control}
              name="weight"
              render={({ field }) => (
                <VitalInput
                  {...VITAL_CONFIGS.weight}
                  value={field.value}
                  onChangeText={field.onChange}
                  error={errors.weight?.message}
                />
              )}
            />
          </View>
          <View style={styles.bpInput}>
            <Controller
              control={control}
              name="height"
              render={({ field }) => (
                <VitalInput
                  {...VITAL_CONFIGS.height}
                  value={field.value}
                  onChangeText={field.onChange}
                  error={errors.height?.message}
                />
              )}
            />
          </View>
        </View>

        {/* BMI Display */}
        {bmi && (
          <Surface style={styles.bmiCard} elevation={1}>
            <Avatar.Icon size={40} icon="calculator" style={styles.bmiIcon} />
            <View style={styles.bmiInfo}>
              <Text variant="labelMedium" style={styles.bmiLabel}>
                Calculated BMI
              </Text>
              <Text variant="headlineMedium" style={styles.bmiValue}>
                {bmi}
              </Text>
            </View>
            <Text variant="labelSmall" style={styles.bmiUnit}>
              kg/m²
            </Text>
          </Surface>
        )}

        {/* Save Button */}
        <Button
          mode="contained"
          onPress={() => void submitVitals()}
          loading={saveMutation.isPending}
          disabled={!hasAnyValue || saveMutation.isPending}
          style={styles.saveButton}
          contentStyle={styles.saveButtonContent}
          icon="content-save"
        >
          Save Vitals
        </Button>
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
  previousCard: {
    marginBottom: 24,
    borderRadius: 12,
    backgroundColor: "#f8f9fa",
  },
  previousTitle: {
    fontWeight: "600",
    opacity: 0.7,
  },
  previousItemTitle: {
    fontSize: 14,
  },
  divider: {
    marginVertical: 8,
  },
  sectionTitle: {
    fontWeight: "600",
    marginBottom: 12,
    marginTop: 8,
  },
  bpRow: {
    flexDirection: "row",
    gap: 12,
  },
  bpInput: {
    flex: 1,
  },
  bmiCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#e7f5ff",
    marginBottom: 16,
  },
  bmiIcon: {
    backgroundColor: "#0F766E",
  },
  bmiInfo: {
    flex: 1,
    marginLeft: 12,
  },
  bmiLabel: {
    opacity: 0.7,
  },
  bmiValue: {
    fontWeight: "bold",
    color: "#0F766E",
  },
  bmiUnit: {
    opacity: 0.6,
  },
  saveButton: {
    marginTop: 24,
    borderRadius: 12,
  },
  saveButtonContent: {
    paddingVertical: 8,
  },
});
