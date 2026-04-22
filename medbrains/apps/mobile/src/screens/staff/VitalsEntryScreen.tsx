import { api } from "@medbrains/api";
import type { Vital } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
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
import { VitalInput, VITAL_CONFIGS } from "../../components";

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

interface VitalFormState {
  temperature: string;
  pulse: string;
  systolic: string;
  diastolic: string;
  respiration: string;
  spo2: string;
  weight: string;
  height: string;
  notes: string;
}

const initialState: VitalFormState = {
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
  const h = Number.parseFloat(height) / 100; // cm to m
  if (w > 0 && h > 0) {
    return (w / (h * h)).toFixed(1);
  }
  return "";
}

export function VitalsEntryScreen({ route, navigation }: VitalsEntryScreenProps) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const { encounterId } = route.params;

  const [vitals, setVitals] = useState<VitalFormState>(initialState);
  const [snackbar, setSnackbar] = useState({ visible: false, message: "" });

  const { data: existingVitals, isLoading } = useQuery({
    queryKey: ["vitals", encounterId],
    queryFn: () => api.listVitals(encounterId || ""),
    enabled: Boolean(encounterId),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!encounterId) throw new Error("No encounter ID");

      // CreateVitalRequest has these fields - send all at once
      const data = {
        temperature: vitals.temperature ? Number.parseFloat(vitals.temperature) : undefined,
        pulse: vitals.pulse ? Number.parseFloat(vitals.pulse) : undefined,
        systolic_bp: vitals.systolic ? Number.parseFloat(vitals.systolic) : undefined,
        diastolic_bp: vitals.diastolic ? Number.parseFloat(vitals.diastolic) : undefined,
        respiratory_rate: vitals.respiration ? Number.parseFloat(vitals.respiration) : undefined,
        spo2: vitals.spo2 ? Number.parseFloat(vitals.spo2) : undefined,
        weight_kg: vitals.weight ? Number.parseFloat(vitals.weight) : undefined,
        height_cm: vitals.height ? Number.parseFloat(vitals.height) : undefined,
        notes: vitals.notes || undefined,
      };

      // createVital takes (encounterId, data)
      await api.createVital(encounterId, data);
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

  const updateVital = (key: keyof VitalFormState, value: string) => {
    setVitals((prev) => ({ ...prev, [key]: value }));
  };

  const bmi = calculateBMI(vitals.weight, vitals.height);
  const hasAnyValue = Object.values(vitals).some((v) => v !== "");

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

        <VitalInput
          {...VITAL_CONFIGS.temperature}
          value={vitals.temperature}
          onChangeText={(v) => updateVital("temperature", v)}
        />

        <VitalInput
          {...VITAL_CONFIGS.pulse}
          value={vitals.pulse}
          onChangeText={(v) => updateVital("pulse", v)}
          required
        />

        <View style={styles.bpRow}>
          <View style={styles.bpInput}>
            <VitalInput
              {...VITAL_CONFIGS.systolic}
              value={vitals.systolic}
              onChangeText={(v) => updateVital("systolic", v)}
              required
            />
          </View>
          <View style={styles.bpInput}>
            <VitalInput
              {...VITAL_CONFIGS.diastolic}
              value={vitals.diastolic}
              onChangeText={(v) => updateVital("diastolic", v)}
              required
            />
          </View>
        </View>

        <VitalInput
          {...VITAL_CONFIGS.respiration}
          value={vitals.respiration}
          onChangeText={(v) => updateVital("respiration", v)}
        />

        <VitalInput
          {...VITAL_CONFIGS.spo2}
          value={vitals.spo2}
          onChangeText={(v) => updateVital("spo2", v)}
        />

        {/* Anthropometry Section */}
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Anthropometry
        </Text>

        <View style={styles.bpRow}>
          <View style={styles.bpInput}>
            <VitalInput
              {...VITAL_CONFIGS.weight}
              value={vitals.weight}
              onChangeText={(v) => updateVital("weight", v)}
            />
          </View>
          <View style={styles.bpInput}>
            <VitalInput
              {...VITAL_CONFIGS.height}
              value={vitals.height}
              onChangeText={(v) => updateVital("height", v)}
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
          onPress={() => saveMutation.mutate()}
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
    backgroundColor: "#228be6",
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
    color: "#228be6",
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
