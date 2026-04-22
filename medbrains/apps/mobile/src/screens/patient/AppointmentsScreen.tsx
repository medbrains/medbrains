import { api } from "@medbrains/api";
import { useAuthStore } from "@medbrains/stores";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Avatar,
  Button,
  Card,
  Chip,
  Dialog,
  FAB,
  Portal,
  SegmentedButtons,
  Snackbar,
  Text,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

type FilterType = "upcoming" | "past" | "cancelled";

interface AppointmentsScreenProps {
  navigation: {
    navigate: (screen: string, params?: Record<string, unknown>) => void;
  };
}

function getStatusColor(status: string): string {
  switch (status) {
    case "confirmed":
      return "#40c057";
    case "pending":
      return "#fab005";
    case "cancelled":
      return "#fa5252";
    case "completed":
      return "#228be6";
    case "no_show":
      return "#868e96";
    default:
      return "#868e96";
  }
}

export function AppointmentsScreen({ navigation }: AppointmentsScreenProps) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const [filter, setFilter] = useState<FilterType>("upcoming");
  const [cancelDialogVisible, setCancelDialogVisible] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState({ visible: false, message: "" });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["appointments", user?.id, filter],
    queryFn: () => api.listPatientAppointments(user?.id || ""),
    enabled: Boolean(user?.id),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.cancelAppointment(id, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      setSnackbar({ visible: true, message: "Appointment cancelled" });
      setCancelDialogVisible(false);
    },
    onError: () => {
      setSnackbar({ visible: true, message: "Failed to cancel appointment" });
    },
  });

  const appointments = data || [];

  const handleCancelPress = (appointmentId: string) => {
    setSelectedAppointment(appointmentId);
    setCancelDialogVisible(true);
  };

  const handleConfirmCancel = () => {
    if (selectedAppointment) {
      cancelMutation.mutate(selectedAppointment);
    }
  };

  const renderAppointmentCard = ({ item }: { item: (typeof appointments)[0] }) => {
    const appointmentDate = new Date(item.appointment_date);
    const isPast = appointmentDate < new Date();
    const statusColor = getStatusColor(item.status || "pending");
    const timeSlot = item.slot_start
      ? `${item.slot_start.slice(0, 5)} - ${item.slot_end.slice(0, 5)}`
      : appointmentDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    return (
      <Card style={styles.appointmentCard}>
        <Card.Content>
          <View style={styles.cardHeader}>
            <View style={styles.dateBox}>
              <Text style={styles.dateDay}>{appointmentDate.getDate()}</Text>
              <Text style={styles.dateMonth}>
                {appointmentDate.toLocaleString("en", { month: "short" })}
              </Text>
            </View>
            <View style={styles.cardInfo}>
              <Text variant="titleMedium" style={styles.doctorName}>
                {item.doctor_name || "Doctor"}
              </Text>
              <Text variant="bodySmall" style={styles.department}>
                {item.department_name || "General"}
              </Text>
              <View style={styles.cardMeta}>
                <Chip compact icon="clock">
                  {timeSlot}
                </Chip>
                <Chip
                  compact
                  style={{ backgroundColor: `${statusColor}20` }}
                  textStyle={{ color: statusColor }}
                >
                  {item.status || "pending"}
                </Chip>
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          {!isPast && item.status !== "cancelled" && item.status !== "completed" && (
            <View style={styles.cardActions}>
              <Button
                mode="outlined"
                compact
                icon="calendar-edit"
                onPress={() => navigation.navigate("AppointmentBook", { appointmentId: item.id })}
                style={styles.actionButton}
              >
                Reschedule
              </Button>
              <Button
                mode="outlined"
                compact
                icon="close"
                onPress={() => handleCancelPress(item.id)}
                style={[styles.actionButton, styles.cancelButton]}
                textColor="#fa5252"
              >
                Cancel
              </Button>
            </View>
          )}

          {/* Track Queue - show for today's confirmed appointments */}
          {item.status === "confirmed" && !isPast && (
            <Button
              mode="contained"
              icon="account-clock"
              onPress={() => navigation.navigate("QueuePosition", { appointmentId: item.id })}
              style={styles.queueButton}
            >
              Track Queue Position
            </Button>
          )}
        </Card.Content>
      </Card>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <SegmentedButtons
          value={filter}
          onValueChange={(v) => setFilter(v as FilterType)}
          buttons={[
            { value: "upcoming", label: "Upcoming" },
            { value: "past", label: "Past" },
            { value: "cancelled", label: "Cancelled" },
          ]}
        />
      </View>

      {/* Appointments List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <Text variant="bodyMedium" style={styles.loadingText}>
            Loading appointments...
          </Text>
        </View>
      ) : appointments.length > 0 ? (
        <FlatList
          data={appointments}
          keyExtractor={(item) => item.id}
          renderItem={renderAppointmentCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onRefresh={refetch}
          refreshing={isLoading}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Avatar.Icon size={64} icon="calendar-blank" style={styles.emptyIcon} />
          <Text variant="titleMedium" style={styles.emptyTitle}>
            No appointments
          </Text>
          <Text variant="bodyMedium" style={styles.emptyText}>
            {filter === "upcoming"
              ? "You have no upcoming appointments"
              : filter === "past"
                ? "No past appointments found"
                : "No cancelled appointments"}
          </Text>
          {filter === "upcoming" && (
            <Button
              mode="contained"
              onPress={() => navigation.navigate("AppointmentBook", {})}
              style={styles.bookButton}
              icon="calendar-plus"
            >
              Book Appointment
            </Button>
          )}
        </View>
      )}

      {/* Book FAB */}
      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => navigation.navigate("AppointmentBook", {})}
        label="Book"
      />

      {/* Cancel Confirmation Dialog */}
      <Portal>
        <Dialog visible={cancelDialogVisible} onDismiss={() => setCancelDialogVisible(false)}>
          <Dialog.Title>Cancel Appointment</Dialog.Title>
          <Dialog.Content>
            <Text>Are you sure you want to cancel this appointment?</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setCancelDialogVisible(false)}>No, Keep It</Button>
            <Button
              onPress={handleConfirmCancel}
              loading={cancelMutation.isPending}
              textColor="#fa5252"
            >
              Yes, Cancel
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

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
  filterContainer: {
    padding: 16,
  },
  listContent: {
    padding: 16,
    paddingTop: 0,
    paddingBottom: 100,
  },
  appointmentCard: {
    marginBottom: 12,
    borderRadius: 12,
  },
  cardHeader: {
    flexDirection: "row",
    gap: 16,
  },
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
  cardInfo: {
    flex: 1,
  },
  doctorName: {
    fontWeight: "600",
  },
  department: {
    opacity: 0.6,
    marginTop: 2,
  },
  cardMeta: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  cardActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
    borderRadius: 8,
  },
  cancelButton: {
    borderColor: "#fa5252",
  },
  queueButton: {
    marginTop: 12,
    borderRadius: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  loadingText: {
    opacity: 0.6,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    gap: 8,
  },
  emptyIcon: {
    backgroundColor: "#f1f3f5",
    marginBottom: 8,
  },
  emptyTitle: {
    fontWeight: "600",
  },
  emptyText: {
    opacity: 0.6,
    textAlign: "center",
  },
  bookButton: {
    marginTop: 16,
    borderRadius: 12,
  },
  fab: {
    position: "absolute",
    right: 16,
    bottom: 16,
  },
});
