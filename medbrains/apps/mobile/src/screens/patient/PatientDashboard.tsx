import React from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { Avatar, Card, Chip, Surface, Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

interface QuickAction {
  id: string;
  icon: string;
  label: string;
  color: string;
  onPress: () => void;
}

interface UpcomingAppointment {
  id: string;
  doctor_name: string;
  department: string;
  date: string;
  time: string;
  status: "confirmed" | "pending";
}

const QUICK_ACTIONS: QuickAction[] = [
  { id: "appointment", icon: "calendar-plus", label: "Book Appointment", color: "#228be6", onPress: () => {} },
  { id: "lab", icon: "flask", label: "Lab Results", color: "#40c057", onPress: () => {} },
  { id: "prescription", icon: "pill", label: "Prescriptions", color: "#fab005", onPress: () => {} },
  { id: "records", icon: "file-document", label: "Medical Records", color: "#7950f2", onPress: () => {} },
];

function QuickActionButton({ action }: { action: QuickAction }) {
  return (
    <TouchableOpacity
      style={[styles.actionButton, { backgroundColor: action.color }]}
      onPress={action.onPress}
    >
      <Avatar.Icon size={40} icon={action.icon} style={styles.actionIcon} />
      <Text style={styles.actionLabel}>{action.label}</Text>
    </TouchableOpacity>
  );
}

function AppointmentCard({ appointment }: { appointment: UpcomingAppointment }) {
  return (
    <Card style={styles.appointmentCard}>
      <Card.Content style={styles.appointmentContent}>
        <View style={styles.appointmentLeft}>
          <View style={styles.dateBox}>
            <Text style={styles.dateDay}>
              {new Date(appointment.date).getDate()}
            </Text>
            <Text style={styles.dateMonth}>
              {new Date(appointment.date).toLocaleString("en", { month: "short" })}
            </Text>
          </View>
        </View>
        <View style={styles.appointmentRight}>
          <Text variant="titleMedium">{appointment.doctor_name}</Text>
          <Text variant="bodySmall" style={styles.department}>
            {appointment.department}
          </Text>
          <View style={styles.appointmentMeta}>
            <Chip compact icon="clock-outline" style={styles.timeChip}>
              {appointment.time}
            </Chip>
            <Chip
              compact
              mode="flat"
              style={[
                styles.statusChip,
                appointment.status === "confirmed"
                  ? styles.statusConfirmed
                  : styles.statusPending,
              ]}
            >
              {appointment.status}
            </Chip>
          </View>
        </View>
      </Card.Content>
    </Card>
  );
}

export function PatientDashboard() {
  const theme = useTheme();

  // Mock data - replace with API calls
  const patientName = "John Doe";
  const uhid = "UHID-2024-00001";
  const upcomingAppointments: UpcomingAppointment[] = [
    {
      id: "1",
      doctor_name: "Dr. Sarah Smith",
      department: "Cardiology",
      date: "2024-01-20",
      time: "10:30 AM",
      status: "confirmed",
    },
    {
      id: "2",
      doctor_name: "Dr. James Wilson",
      department: "General Medicine",
      date: "2024-01-25",
      time: "2:00 PM",
      status: "pending",
    },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <Surface style={styles.header} elevation={2}>
          <View style={styles.headerContent}>
            <Avatar.Text size={56} label={patientName.slice(0, 2).toUpperCase()} />
            <View style={styles.headerText}>
              <Text variant="headlineSmall" style={styles.welcomeText}>
                Welcome back,
              </Text>
              <Text variant="titleLarge" style={styles.patientName}>
                {patientName}
              </Text>
              <Text variant="bodySmall" style={styles.uhid}>
                {uhid}
              </Text>
            </View>
          </View>
        </Surface>

        {/* Quick Actions */}
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Quick Actions
        </Text>
        <View style={styles.actionsGrid}>
          {QUICK_ACTIONS.map((action) => (
            <QuickActionButton key={action.id} action={action} />
          ))}
        </View>

        {/* Upcoming Appointments */}
        <View style={styles.sectionHeader}>
          <Text variant="titleMedium">Upcoming Appointments</Text>
          <TouchableOpacity>
            <Text variant="labelMedium" style={{ color: theme.colors.primary }}>
              See All
            </Text>
          </TouchableOpacity>
        </View>

        {upcomingAppointments.length > 0 ? (
          <View style={styles.appointmentsList}>
            {upcomingAppointments.map((appt) => (
              <AppointmentCard key={appt.id} appointment={appt} />
            ))}
          </View>
        ) : (
          <Surface style={styles.emptyState} elevation={1}>
            <Avatar.Icon size={48} icon="calendar-blank" />
            <Text variant="bodyMedium" style={styles.emptyText}>
              No upcoming appointments
            </Text>
            <Text
              variant="labelMedium"
              style={{ color: theme.colors.primary }}
              onPress={() => {}}
            >
              Book an appointment
            </Text>
          </Surface>
        )}

        {/* Health Metrics Summary */}
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Recent Vitals
        </Text>
        <Surface style={styles.vitalsCard} elevation={1}>
          <View style={styles.vitalItem}>
            <Text variant="labelSmall" style={styles.vitalLabel}>
              Blood Pressure
            </Text>
            <Text variant="titleMedium" style={styles.vitalValue}>
              120/80
            </Text>
            <Text variant="labelSmall" style={styles.vitalDate}>
              Jan 15
            </Text>
          </View>
          <View style={styles.vitalDivider} />
          <View style={styles.vitalItem}>
            <Text variant="labelSmall" style={styles.vitalLabel}>
              Heart Rate
            </Text>
            <Text variant="titleMedium" style={styles.vitalValue}>
              72 bpm
            </Text>
            <Text variant="labelSmall" style={styles.vitalDate}>
              Jan 15
            </Text>
          </View>
          <View style={styles.vitalDivider} />
          <View style={styles.vitalItem}>
            <Text variant="labelSmall" style={styles.vitalLabel}>
              Weight
            </Text>
            <Text variant="titleMedium" style={styles.vitalValue}>
              70 kg
            </Text>
            <Text variant="labelSmall" style={styles.vitalDate}>
              Jan 10
            </Text>
          </View>
        </Surface>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  header: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  headerText: {
    flex: 1,
  },
  welcomeText: {
    opacity: 0.6,
  },
  patientName: {
    fontWeight: "bold",
  },
  uhid: {
    opacity: 0.5,
    marginTop: 2,
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
  actionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  actionButton: {
    width: "48%",
    aspectRatio: 1.5,
    borderRadius: 12,
    padding: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  actionIcon: {
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  actionLabel: {
    color: "#ffffff",
    fontWeight: "600",
    marginTop: 8,
    fontSize: 14,
  },
  appointmentsList: {
    gap: 12,
  },
  appointmentCard: {
    borderRadius: 12,
  },
  appointmentContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  appointmentLeft: {},
  dateBox: {
    backgroundColor: "#e7f5ff",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
    minWidth: 56,
  },
  dateDay: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#228be6",
  },
  dateMonth: {
    fontSize: 12,
    color: "#228be6",
    textTransform: "uppercase",
  },
  appointmentRight: {
    flex: 1,
  },
  department: {
    opacity: 0.6,
    marginTop: 2,
  },
  appointmentMeta: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  timeChip: {
    height: 28,
  },
  statusChip: {
    height: 28,
  },
  statusConfirmed: {
    backgroundColor: "#d3f9d8",
  },
  statusPending: {
    backgroundColor: "#fff3bf",
  },
  emptyState: {
    borderRadius: 12,
    padding: 32,
    alignItems: "center",
    gap: 8,
  },
  emptyText: {
    opacity: 0.6,
  },
  vitalsCard: {
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  vitalItem: {
    flex: 1,
    alignItems: "center",
  },
  vitalLabel: {
    opacity: 0.6,
    marginBottom: 4,
  },
  vitalValue: {
    fontWeight: "bold",
  },
  vitalDate: {
    opacity: 0.4,
    marginTop: 4,
  },
  vitalDivider: {
    width: 1,
    backgroundColor: "#dee2e6",
  },
});
