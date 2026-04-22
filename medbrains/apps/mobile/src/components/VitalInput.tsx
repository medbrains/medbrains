import React from "react";
import { StyleSheet, View } from "react-native";
import { HelperText, Surface, Text, TextInput } from "react-native-paper";

interface VitalInputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  unit: string;
  icon?: string;
  keyboardType?: "numeric" | "decimal-pad" | "default";
  error?: string;
  normalRange?: string;
  required?: boolean;
}

export function VitalInput({
  label,
  value,
  onChangeText,
  unit,
  icon = "thermometer",
  keyboardType = "decimal-pad",
  error,
  normalRange,
  required = false,
}: VitalInputProps) {
  const hasError = Boolean(error);

  return (
    <Surface style={styles.container} elevation={1}>
      <View style={styles.header}>
        <Text variant="labelMedium" style={styles.label}>
          {label}
          {required && <Text style={styles.required}> *</Text>}
        </Text>
        {normalRange && (
          <Text variant="labelSmall" style={styles.range}>
            Normal: {normalRange}
          </Text>
        )}
      </View>

      <View style={styles.inputRow}>
        <TextInput
          mode="outlined"
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          style={styles.input}
          left={<TextInput.Icon icon={icon} />}
          error={hasError}
          dense
        />
        <View style={styles.unitBadge}>
          <Text variant="labelMedium" style={styles.unitText}>
            {unit}
          </Text>
        </View>
      </View>

      {hasError && (
        <HelperText type="error" visible>
          {error}
        </HelperText>
      )}
    </Surface>
  );
}

// Predefined vital configurations
export const VITAL_CONFIGS = {
  temperature: {
    label: "Temperature",
    unit: "°F",
    icon: "thermometer",
    normalRange: "97.8 - 99.1",
    keyboardType: "decimal-pad" as const,
  },
  pulse: {
    label: "Pulse Rate",
    unit: "bpm",
    icon: "heart-pulse",
    normalRange: "60 - 100",
    keyboardType: "numeric" as const,
  },
  systolic: {
    label: "Systolic BP",
    unit: "mmHg",
    icon: "heart",
    normalRange: "90 - 120",
    keyboardType: "numeric" as const,
  },
  diastolic: {
    label: "Diastolic BP",
    unit: "mmHg",
    icon: "heart",
    normalRange: "60 - 80",
    keyboardType: "numeric" as const,
  },
  respiration: {
    label: "Respiration Rate",
    unit: "/min",
    icon: "lungs",
    normalRange: "12 - 20",
    keyboardType: "numeric" as const,
  },
  spo2: {
    label: "SpO2",
    unit: "%",
    icon: "water-percent",
    normalRange: "95 - 100",
    keyboardType: "numeric" as const,
  },
  weight: {
    label: "Weight",
    unit: "kg",
    icon: "scale",
    normalRange: undefined,
    keyboardType: "decimal-pad" as const,
  },
  height: {
    label: "Height",
    unit: "cm",
    icon: "human-male-height",
    normalRange: undefined,
    keyboardType: "decimal-pad" as const,
  },
  bmi: {
    label: "BMI",
    unit: "kg/m²",
    icon: "calculator",
    normalRange: "18.5 - 24.9",
    keyboardType: "decimal-pad" as const,
  },
  bloodSugar: {
    label: "Blood Sugar",
    unit: "mg/dL",
    icon: "diabetes",
    normalRange: "70 - 100 (fasting)",
    keyboardType: "numeric" as const,
  },
};

const styles = StyleSheet.create({
  container: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  label: {
    fontWeight: "600",
  },
  required: {
    color: "#fa5252",
  },
  range: {
    opacity: 0.6,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  input: {
    flex: 1,
  },
  unitBadge: {
    backgroundColor: "#e7f5ff",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 60,
    alignItems: "center",
  },
  unitText: {
    color: "#228be6",
    fontWeight: "600",
  },
});
