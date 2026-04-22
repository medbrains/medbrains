import { api } from "@medbrains/api";
import { useQuery } from "@tanstack/react-query";
import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Avatar,
  Button,
  Card,
  Chip,
  Divider,
  Surface,
  Text,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

interface QueuePositionScreenProps {
  route: {
    params: {
      appointmentId: string;
    };
  };
  navigation: {
    goBack: () => void;
  };
}

export function QueuePositionScreen({ route, navigation }: QueuePositionScreenProps) {
  const theme = useTheme();
  const { appointmentId } = route.params;

  const [refreshKey, setRefreshKey] = useState(0);

  const { data: appointment, isLoading } = useQuery({
    queryKey: ["appointment", appointmentId, refreshKey],
    queryFn: () => api.getAppointment(appointmentId),
    refetchInterval: 15000, // Refresh every 15 seconds
  });

  const { data: waitEstimate } = useQuery({
    queryKey: ["waitEstimate", appointment?.department_id, refreshKey],
    queryFn: () =>
      api.getWaitEstimate({
        department_id: appointment?.department_id,
        doctor_id: appointment?.doctor_id,
      }),
    enabled: Boolean(appointment?.department_id),
    refetchInterval: 15000,
  });

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshKey((prev) => prev + 1);
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" />
        <Text variant="bodyMedium" style={styles.loadingText}>
          Loading queue status...
        </Text>
      </SafeAreaView>
    );
  }

  if (!appointment) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <Avatar.Icon size={64} icon="alert-circle" style={styles.errorIcon} />
        <Text variant="titleMedium">Appointment not found</Text>
        <Button mode="contained" onPress={() => navigation.goBack()} style={styles.backButton}>
          Go Back
        </Button>
      </SafeAreaView>
    );
  }

  const tokenNumber = appointment.token_number || 0;
  const queuePosition = waitEstimate?.queue_position || 0;
  const estimatedWait = waitEstimate?.estimated_minutes || 0;

  const getStatusInfo = () => {
    switch (appointment.status) {
      case "checked_in":
        return {
          icon: "account-check",
          title: "Checked In",
          subtitle: "Waiting to be called",
          color: "#fab005",
          bgColor: "#fff3bf",
        };
      case "in_consultation":
        return {
          icon: "doctor",
          title: "In Consultation",
          subtitle: "Doctor is with you now",
          color: "#228be6",
          bgColor: "#e7f5ff",
        };
      case "completed":
        return {
          icon: "check-circle",
          title: "Visit Complete",
          subtitle: "Thank you for visiting",
          color: "#40c057",
          bgColor: "#d3f9d8",
        };
      case "confirmed":
        return {
          icon: "clock-outline",
          title: "Confirmed",
          subtitle: "Please check in on arrival",
          color: "#228be6",
          bgColor: "#e7f5ff",
        };
      default:
        return {
          icon: "clock-outline",
          title: "Waiting",
          subtitle: `${queuePosition} patient(s) ahead of you`,
          color: "#fab005",
          bgColor: "#fff3bf",
        };
    }
  };

  const statusInfo = getStatusInfo();
  const isInQueue = appointment.status === "checked_in";

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Status Banner */}
      <Surface
        style={[styles.statusBanner, { backgroundColor: statusInfo.bgColor }]}
        elevation={0}
      >
        <Avatar.Icon
          size={64}
          icon={statusInfo.icon}
          style={{ backgroundColor: statusInfo.color }}
        />
        <Text variant="headlineSmall" style={[styles.statusTitle, { color: statusInfo.color }]}>
          {statusInfo.title}
        </Text>
        <Text variant="bodyMedium" style={styles.statusSubtitle}>
          {statusInfo.subtitle}
        </Text>
      </Surface>

      {/* Token Card */}
      {tokenNumber > 0 && (
        <Card style={styles.tokenCard}>
          <Card.Content style={styles.tokenContent}>
            <Text variant="labelMedium" style={styles.tokenLabel}>
              Your Token Number
            </Text>
            <Text style={styles.tokenNumber}>{tokenNumber}</Text>
            {isInQueue && queuePosition > 0 && (
              <Chip icon="account-clock" style={styles.tokenChip}>
                Position: #{queuePosition}
              </Chip>
            )}
          </Card.Content>
        </Card>
      )}

      {/* Queue Progress */}
      {isInQueue && (
        <Card style={styles.progressCard}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.progressTitle}>
              Queue Progress
            </Text>
            <Divider style={styles.divider} />

            <View style={styles.progressRow}>
              <View style={styles.progressItem}>
                <Text variant="headlineMedium" style={styles.progressValue}>
                  {queuePosition}
                </Text>
                <Text variant="labelSmall" style={styles.progressLabel}>
                  Patients Ahead
                </Text>
              </View>

              <View style={styles.progressItem}>
                <Text variant="headlineMedium" style={[styles.progressValue, styles.yourToken]}>
                  ~{estimatedWait}
                </Text>
                <Text variant="labelSmall" style={styles.progressLabel}>
                  Minutes Wait
                </Text>
              </View>
            </View>

            {/* Estimated Wait */}
            <Surface style={styles.waitEstimate} elevation={0}>
              <Avatar.Icon size={32} icon="clock-outline" style={styles.waitIcon} />
              <View style={styles.waitInfo}>
                <Text variant="labelMedium">Estimated Wait Time</Text>
                <Text variant="titleLarge" style={styles.waitTime}>
                  {estimatedWait > 0 ? `~${estimatedWait} minutes` : "Very soon!"}
                </Text>
              </View>
            </Surface>
          </Card.Content>
        </Card>
      )}

      {/* Appointment Info */}
      <Card style={styles.infoCard}>
        <Card.Content>
          <View style={styles.infoRow}>
            <Avatar.Icon size={48} icon="calendar" style={styles.calendarIcon} />
            <View style={styles.infoText}>
              <Text variant="titleMedium">
                {new Date(appointment.appointment_date).toLocaleDateString()}
              </Text>
              <Text variant="bodySmall" style={styles.infoSubtext}>
                {appointment.slot_start.slice(0, 5)} - {appointment.slot_end.slice(0, 5)}
              </Text>
            </View>
          </View>

          <Divider style={styles.divider} />

          <View style={styles.infoRow}>
            <Avatar.Icon size={48} icon="clipboard-text" style={styles.reasonIcon} />
            <View style={styles.infoText}>
              <Text variant="titleMedium">{appointment.appointment_type}</Text>
              <Text variant="bodySmall" style={styles.infoSubtext}>
                {appointment.reason || "General Consultation"}
              </Text>
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* Action Buttons */}
      <View style={styles.actions}>
        <Button
          mode="outlined"
          icon="map-marker"
          onPress={() => {
            // Navigate to wayfinding
          }}
          style={styles.navButton}
        >
          Get Directions
        </Button>

        <Button
          mode="text"
          icon="refresh"
          onPress={() => setRefreshKey((prev) => prev + 1)}
        >
          Refresh Status
        </Button>
      </View>

      {/* Last Updated */}
      <Text variant="labelSmall" style={styles.lastUpdated}>
        Last updated: {new Date().toLocaleTimeString()}
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
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
  backButton: {
    marginTop: 16,
  },
  statusBanner: {
    padding: 24,
    borderRadius: 16,
    alignItems: "center",
    marginBottom: 16,
  },
  statusTitle: {
    fontWeight: "bold",
    marginTop: 12,
  },
  statusSubtitle: {
    opacity: 0.7,
    marginTop: 4,
  },
  tokenCard: {
    borderRadius: 16,
    marginBottom: 16,
    backgroundColor: "#228be6",
  },
  tokenContent: {
    alignItems: "center",
    padding: 24,
  },
  tokenLabel: {
    color: "rgba(255,255,255,0.8)",
  },
  tokenNumber: {
    fontSize: 72,
    fontWeight: "bold",
    color: "#fff",
    lineHeight: 80,
  },
  tokenChip: {
    marginTop: 8,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  progressCard: {
    borderRadius: 16,
    marginBottom: 16,
  },
  progressTitle: {
    fontWeight: "600",
  },
  divider: {
    marginVertical: 12,
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  progressItem: {
    alignItems: "center",
    flex: 1,
  },
  progressValue: {
    fontWeight: "bold",
  },
  yourToken: {
    color: "#228be6",
  },
  progressLabel: {
    opacity: 0.6,
    marginTop: 4,
  },
  waitEstimate: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#fff3bf",
  },
  waitIcon: {
    backgroundColor: "#fab005",
  },
  waitInfo: {
    flex: 1,
  },
  waitTime: {
    fontWeight: "bold",
    color: "#f59f00",
  },
  infoCard: {
    borderRadius: 16,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  calendarIcon: {
    backgroundColor: "#e7f5ff",
  },
  reasonIcon: {
    backgroundColor: "#d3f9d8",
  },
  infoText: {
    flex: 1,
  },
  infoSubtext: {
    opacity: 0.6,
    marginTop: 2,
  },
  actions: {
    gap: 12,
  },
  navButton: {
    borderRadius: 12,
  },
  lastUpdated: {
    textAlign: "center",
    opacity: 0.4,
    marginTop: 16,
  },
});
