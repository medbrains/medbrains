import { api } from "@medbrains/api";
import type { PatientVisitRow } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Avatar,
  Button,
  Card,
  Chip,
  Divider,
  List,
  Surface,
  Text,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

interface PatientDetailScreenProps {
  route: {
    params: {
      patientId: string;
    };
  };
  navigation: {
    navigate: (screen: string, params?: Record<string, unknown>) => void;
  };
}

function calculateAge(dob?: string | null): string {
  if (!dob) return "Unknown";
  const birthDate = new Date(dob);
  const today = new Date();
  let years = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    years--;
  }
  return `${years} years`;
}

export function PatientDetailScreen({ route, navigation }: PatientDetailScreenProps) {
  const theme = useTheme();
  const { patientId } = route.params;

  const { data: patient, isLoading } = useQuery({
    queryKey: ["patient", patientId],
    queryFn: () => api.getPatient(patientId),
  });

  const { data: visits } = useQuery({
    queryKey: ["patient", patientId, "visits"],
    queryFn: () => api.listPatientVisits(patientId),
    enabled: Boolean(patientId),
  });

  const { data: allergies } = useQuery({
    queryKey: ["patient", patientId, "allergies"],
    queryFn: () => api.listPatientAllergies(patientId),
    enabled: Boolean(patientId),
  });

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" />
        <Text variant="bodyMedium" style={styles.loadingText}>
          Loading patient details...
        </Text>
      </SafeAreaView>
    );
  }

  if (!patient) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <Avatar.Icon size={64} icon="account-off" style={styles.errorIcon} />
        <Text variant="titleMedium">Patient not found</Text>
      </SafeAreaView>
    );
  }

  const fullName = `${patient.first_name} ${patient.last_name}`;
  const initials = `${patient.first_name.charAt(0)}${patient.last_name.charAt(0)}`.toUpperCase();

  // Format address if it's an object
  const formatAddress = (addr: Record<string, unknown> | undefined): string => {
    if (!addr) return "Not specified";
    const parts = [
      addr.line1 as string,
      addr.city as string,
      addr.state as string,
      addr.pincode as string,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : "Not specified";
  };

  const visitsList: PatientVisitRow[] = visits || [];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Patient Header Card */}
        <Surface style={styles.headerCard} elevation={2}>
          <View style={styles.headerRow}>
            <Avatar.Text size={64} label={initials} style={styles.avatar} />
            <View style={styles.headerInfo}>
              <Text variant="headlineSmall" style={styles.patientName}>
                {fullName}
              </Text>
              <Text variant="bodyMedium" style={styles.uhid}>
                {patient.uhid}
              </Text>
              <View style={styles.chips}>
                <Chip compact icon="calendar">
                  {calculateAge(patient.date_of_birth)}
                </Chip>
                {patient.gender && (
                  <Chip compact icon={patient.gender === "male" ? "gender-male" : "gender-female"}>
                    {patient.gender}
                  </Chip>
                )}
                {patient.blood_group && (
                  <Chip compact icon="water" style={styles.bloodChip}>
                    {patient.blood_group}
                  </Chip>
                )}
              </View>
            </View>
          </View>

          {/* Contact Info */}
          {patient.phone && (
            <View style={styles.contactRow}>
              <Avatar.Icon size={32} icon="phone" style={styles.contactIcon} />
              <Text variant="bodyMedium">{patient.phone}</Text>
            </View>
          )}
          {patient.email && (
            <View style={styles.contactRow}>
              <Avatar.Icon size={32} icon="email" style={styles.contactIcon} />
              <Text variant="bodyMedium">{patient.email}</Text>
            </View>
          )}
        </Surface>

        {/* Quick Actions */}
        <View style={styles.actionsRow}>
          <Button
            mode="contained"
            icon="clipboard-plus"
            onPress={() => navigation.navigate("Vitals", { patientId })}
            style={styles.actionButton}
          >
            Vitals
          </Button>
          <Button
            mode="contained"
            icon="pill"
            onPress={() => navigation.navigate("Prescription", { patientId })}
            style={styles.actionButton}
          >
            Rx
          </Button>
          <Button
            mode="contained"
            icon="flask"
            onPress={() => navigation.navigate("LabOrder", { patientId })}
            style={styles.actionButton}
          >
            Lab
          </Button>
        </View>

        {/* Allergies Alert */}
        {allergies && allergies.length > 0 && (
          <Card style={styles.alertCard}>
            <Card.Content>
              <View style={styles.alertHeader}>
                <Avatar.Icon size={24} icon="alert" style={styles.alertIcon} color="#fa5252" />
                <Text variant="titleSmall" style={styles.alertTitle}>
                  Allergies
                </Text>
              </View>
              <View style={styles.allergyChips}>
                {allergies.map((allergy) => (
                  <Chip
                    key={allergy.id}
                    mode="flat"
                    style={styles.allergyChip}
                    textStyle={styles.allergyText}
                  >
                    {allergy.allergen_name}
                  </Chip>
                ))}
              </View>
            </Card.Content>
          </Card>
        )}

        {/* Recent Visits */}
        <Card style={styles.sectionCard}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Recent Visits
            </Text>
            <Divider style={styles.divider} />

            {visitsList.length > 0 ? (
              visitsList.map((visit) => (
                <List.Item
                  key={visit.id}
                  title={visit.department_name || "Consultation"}
                  description={new Date(visit.encounter_date).toLocaleDateString()}
                  left={(props) => <List.Icon {...props} icon="calendar-clock" />}
                  right={() => (
                    <Chip compact>
                      {visit.encounter_type}
                    </Chip>
                  )}
                />
              ))
            ) : (
              <View style={styles.emptySection}>
                <Text variant="bodyMedium" style={styles.emptyText}>
                  No recent visits
                </Text>
              </View>
            )}
          </Card.Content>
        </Card>

        {/* Patient Info */}
        <Card style={styles.sectionCard}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Patient Information
            </Text>
            <Divider style={styles.divider} />

            <List.Item
              title="Date of Birth"
              description={
                patient.date_of_birth
                  ? new Date(patient.date_of_birth).toLocaleDateString()
                  : "Not specified"
              }
              left={(props) => <List.Icon {...props} icon="cake-variant" />}
            />
            <List.Item
              title="Marital Status"
              description={patient.marital_status || "Not specified"}
              left={(props) => <List.Icon {...props} icon="account-heart" />}
            />
            <List.Item
              title="Occupation"
              description={patient.occupation || "Not specified"}
              left={(props) => <List.Icon {...props} icon="briefcase" />}
            />
            <List.Item
              title="Address"
              description={formatAddress(patient.address as Record<string, unknown> | undefined)}
              left={(props) => <List.Icon {...props} icon="map-marker" />}
            />
          </Card.Content>
        </Card>
      </ScrollView>
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
    gap: 16,
  },
  loadingText: {
    opacity: 0.6,
  },
  errorIcon: {
    backgroundColor: "#fff5f5",
    marginBottom: 8,
  },
  scrollContent: {
    padding: 16,
  },
  headerCard: {
    padding: 16,
    borderRadius: 16,
  },
  headerRow: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 16,
  },
  avatar: {
    backgroundColor: "#228be6",
  },
  headerInfo: {
    flex: 1,
  },
  patientName: {
    fontWeight: "bold",
  },
  uhid: {
    opacity: 0.6,
    marginTop: 2,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  bloodChip: {
    backgroundColor: "#fff5f5",
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 8,
  },
  contactIcon: {
    backgroundColor: "#e7f5ff",
  },
  actionsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  actionButton: {
    flex: 1,
    borderRadius: 12,
  },
  alertCard: {
    marginTop: 16,
    backgroundColor: "#fff5f5",
    borderRadius: 12,
  },
  alertHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  alertIcon: {
    backgroundColor: "#ffe3e3",
  },
  alertTitle: {
    color: "#fa5252",
    fontWeight: "600",
  },
  allergyChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  allergyChip: {
    backgroundColor: "#ffe3e3",
  },
  allergyText: {
    color: "#c92a2a",
  },
  sectionCard: {
    marginTop: 16,
    borderRadius: 12,
  },
  sectionTitle: {
    fontWeight: "600",
  },
  divider: {
    marginVertical: 12,
  },
  emptySection: {
    padding: 16,
    alignItems: "center",
  },
  emptyText: {
    opacity: 0.6,
  },
});
