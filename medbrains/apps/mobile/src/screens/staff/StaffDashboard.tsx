import React from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import {
  Avatar,
  Badge,
  Card,
  Chip,
  FAB,
  Surface,
  Text,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

interface QueuePatient {
  id: string;
  token_number: number;
  patient_name: string;
  uhid: string;
  status: "waiting" | "called" | "in_consultation";
  wait_time_minutes: number;
}

interface StatCard {
  id: string;
  label: string;
  value: number;
  icon: string;
  color: string;
  trend?: "up" | "down";
  trendValue?: string;
}

const TODAY_STATS: StatCard[] = [
  { id: "patients", label: "Patients Today", value: 45, icon: "account-group", color: "#228be6" },
  { id: "waiting", label: "Waiting", value: 8, icon: "clock-outline", color: "#fab005" },
  { id: "completed", label: "Completed", value: 37, icon: "check-circle", color: "#40c057" },
  { id: "pending", label: "Pending Results", value: 12, icon: "flask", color: "#7950f2" },
];

function StatCardItem({ stat }: { stat: StatCard }) {
  return (
    <Surface style={[styles.statCard, { borderLeftColor: stat.color }]} elevation={1}>
      <Avatar.Icon
        size={36}
        icon={stat.icon}
        style={{ backgroundColor: `${stat.color}20` }}
        color={stat.color}
      />
      <View style={styles.statContent}>
        <Text variant="headlineMedium" style={styles.statValue}>
          {stat.value}
        </Text>
        <Text variant="labelSmall" style={styles.statLabel}>
          {stat.label}
        </Text>
      </View>
    </Surface>
  );
}

function QueueItem({ patient, onCall }: { patient: QueuePatient; onCall: () => void }) {
  const isWaiting = patient.status === "waiting";
  const statusColor = patient.status === "in_consultation" ? "#40c057" :
    patient.status === "called" ? "#228be6" : "#868e96";

  return (
    <Card style={styles.queueCard}>
      <Card.Content style={styles.queueContent}>
        <View style={styles.tokenBadge}>
          <Text style={styles.tokenNumber}>{patient.token_number}</Text>
        </View>
        <View style={styles.patientInfo}>
          <Text variant="titleMedium">{patient.patient_name}</Text>
          <Text variant="bodySmall" style={styles.uhidText}>
            {patient.uhid}
          </Text>
          <View style={styles.queueMeta}>
            <Chip
              compact
              mode="flat"
              style={[styles.statusChip, { backgroundColor: `${statusColor}20` }]}
              textStyle={{ color: statusColor }}
            >
              {patient.status.replace("_", " ")}
            </Chip>
            {isWaiting && (
              <Text variant="labelSmall" style={styles.waitTime}>
                {patient.wait_time_minutes} min wait
              </Text>
            )}
          </View>
        </View>
        {isWaiting && (
          <TouchableOpacity style={styles.callButton} onPress={onCall}>
            <Avatar.Icon size={40} icon="phone" />
          </TouchableOpacity>
        )}
      </Card.Content>
    </Card>
  );
}

export function StaffDashboard() {
  const theme = useTheme();

  // Mock data
  const staffName = "Dr. Sarah Smith";
  const department = "Cardiology";
  const queuePatients: QueuePatient[] = [
    { id: "1", token_number: 23, patient_name: "John Doe", uhid: "UHID001", status: "in_consultation", wait_time_minutes: 0 },
    { id: "2", token_number: 24, patient_name: "Jane Smith", uhid: "UHID002", status: "called", wait_time_minutes: 5 },
    { id: "3", token_number: 25, patient_name: "Robert Brown", uhid: "UHID003", status: "waiting", wait_time_minutes: 15 },
    { id: "4", token_number: 26, patient_name: "Emily Davis", uhid: "UHID004", status: "waiting", wait_time_minutes: 22 },
  ];

  const handleCallPatient = (_patientId: string) => {
    // TODO: Implement call patient logic
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text variant="titleLarge" style={styles.greeting}>
              Good Morning,
            </Text>
            <Text variant="headlineSmall" style={styles.staffName}>
              {staffName}
            </Text>
            <Chip compact icon="hospital-building" style={styles.deptChip}>
              {department}
            </Chip>
          </View>
          <Avatar.Text size={56} label="SS" />
        </View>

        {/* Today's Stats */}
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Today's Overview
        </Text>
        <View style={styles.statsGrid}>
          {TODAY_STATS.map((stat) => (
            <StatCardItem key={stat.id} stat={stat} />
          ))}
        </View>

        {/* Current Queue */}
        <View style={styles.sectionHeader}>
          <Text variant="titleMedium">Current Queue</Text>
          <Badge size={24}>{queuePatients.filter((p) => p.status === "waiting").length}</Badge>
        </View>
        <View style={styles.queueList}>
          {queuePatients.map((patient) => (
            <QueueItem
              key={patient.id}
              patient={patient}
              onCall={() => handleCallPatient(patient.id)}
            />
          ))}
        </View>

        {/* Quick Actions */}
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Quick Actions
        </Text>
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.quickAction}>
            <Avatar.Icon size={40} icon="account-search" />
            <Text variant="labelMedium">Find Patient</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAction}>
            <Avatar.Icon size={40} icon="clipboard-plus" />
            <Text variant="labelMedium">New Order</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAction}>
            <Avatar.Icon size={40} icon="file-document-edit" />
            <Text variant="labelMedium">Write Rx</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAction}>
            <Avatar.Icon size={40} icon="flask" />
            <Text variant="labelMedium">Lab Results</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => {}}
        label="Register"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 80,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  headerLeft: {},
  greeting: {
    opacity: 0.6,
  },
  staffName: {
    fontWeight: "bold",
    marginBottom: 8,
  },
  deptChip: {
    alignSelf: "flex-start",
  },
  sectionTitle: {
    marginBottom: 12,
    fontWeight: "600",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    marginTop: 24,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  statCard: {
    width: "48%",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
  },
  statContent: {
    flex: 1,
  },
  statValue: {
    fontWeight: "bold",
  },
  statLabel: {
    opacity: 0.6,
  },
  queueList: {
    gap: 12,
  },
  queueCard: {
    borderRadius: 12,
  },
  queueContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  tokenBadge: {
    backgroundColor: "#228be6",
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  tokenNumber: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "bold",
  },
  patientInfo: {
    flex: 1,
  },
  uhidText: {
    opacity: 0.5,
    marginTop: 2,
  },
  queueMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  statusChip: {
    height: 24,
  },
  waitTime: {
    opacity: 0.6,
  },
  callButton: {
    opacity: 0.8,
  },
  quickActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  quickAction: {
    flex: 1,
    alignItems: "center",
    gap: 8,
    padding: 16,
    backgroundColor: "#f8f9fa",
    borderRadius: 12,
  },
  fab: {
    position: "absolute",
    right: 16,
    bottom: 16,
  },
});
