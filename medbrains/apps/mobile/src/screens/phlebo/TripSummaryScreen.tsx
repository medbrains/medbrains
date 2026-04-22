import { api } from "@medbrains/api";
import { useAuthStore } from "@medbrains/stores";
import type { LabHomeCollection } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import React, { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Avatar,
  Button,
  Card,
  Chip,
  Dialog,
  Divider,
  List,
  Portal,
  Snackbar,
  Surface,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

interface TripSummaryScreenProps {
  navigation: {
    navigate: (screen: string, params?: Record<string, unknown>) => void;
    goBack: () => void;
  };
}

export function TripSummaryScreen({ navigation }: TripSummaryScreenProps) {
  const theme = useTheme();
  const { user } = useAuthStore();

  const [endTripDialogVisible, setEndTripDialogVisible] = useState(false);
  const [totalDistance, setTotalDistance] = useState("");
  const [snackbar, setSnackbar] = useState({ visible: false, message: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["homeCollections", user?.id, "today"],
    queryFn: () => {
      const today = new Date().toISOString().split("T")[0] ?? "";
      const params: Record<string, string> = {
        date: today,
      };
      if (user?.id) {
        params.phlebotomist_id = user.id;
      }
      return api.listHomeCollections(params);
    },
    enabled: Boolean(user?.id),
  });

  const collections: LabHomeCollection[] = data || [];
  const completed = collections.filter(
    (c) => c.status === "collected" || c.status === "returned_to_lab"
  );
  const pending = collections.filter(
    (c) => c.status === "scheduled" || c.status === "assigned" || c.status === "in_transit" || c.status === "arrived"
  );
  const cancelled = collections.filter((c) => c.status === "cancelled");

  // Estimate samples based on completed collections (since we don't have test_names)
  const estimatedSamples = completed.length;

  const handleEndTrip = () => {
    // In a real app, this would submit the trip report
    setSnackbar({ visible: true, message: "Trip ended successfully" });
    setEndTripDialogVisible(false);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  const completionRate = collections.length > 0
    ? Math.round((completed.length / collections.length) * 100)
    : 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Day Summary Card */}
        <Surface style={styles.summaryCard} elevation={2}>
          <Text variant="titleLarge" style={styles.summaryTitle}>
            Today's Summary
          </Text>
          <Text variant="bodySmall" style={styles.summaryDate}>
            {new Date().toLocaleDateString("en-IN", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </Text>

          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text variant="displaySmall" style={[styles.statValue, { color: "#228be6" }]}>
                {collections.length}
              </Text>
              <Text variant="labelSmall" style={styles.statLabel}>Total Assigned</Text>
            </View>
            <View style={styles.statItem}>
              <Text variant="displaySmall" style={[styles.statValue, { color: "#40c057" }]}>
                {completed.length}
              </Text>
              <Text variant="labelSmall" style={styles.statLabel}>Completed</Text>
            </View>
            <View style={styles.statItem}>
              <Text variant="displaySmall" style={[styles.statValue, { color: "#fab005" }]}>
                {pending.length}
              </Text>
              <Text variant="labelSmall" style={styles.statLabel}>Pending</Text>
            </View>
            <View style={styles.statItem}>
              <Text variant="displaySmall" style={[styles.statValue, { color: "#fa5252" }]}>
                {cancelled.length}
              </Text>
              <Text variant="labelSmall" style={styles.statLabel}>Cancelled</Text>
            </View>
          </View>

          {/* Completion Progress */}
          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text variant="labelMedium">Completion Rate</Text>
              <Text variant="titleMedium" style={styles.progressPercent}>
                {completionRate}%
              </Text>
            </View>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${completionRate}%` },
                ]}
              />
            </View>
          </View>
        </Surface>

        {/* Samples Collected */}
        <Card style={styles.samplesCard}>
          <Card.Content>
            <View style={styles.samplesHeader}>
              <Avatar.Icon size={40} icon="flask" style={styles.samplesIcon} />
              <View style={styles.samplesInfo}>
                <Text variant="titleMedium">Collections Completed</Text>
                <Text variant="headlineMedium" style={styles.samplesCount}>
                  {estimatedSamples}
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Completed Collections */}
        <Card style={styles.listCard}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Completed Collections
            </Text>
            <Divider style={styles.divider} />

            {completed.length > 0 ? (
              completed.map((collection) => {
                const addressParts = [collection.address_line, collection.city].filter(Boolean);
                const address = addressParts.length > 0 ? addressParts.join(", ") : "Address not provided";
                return (
                  <List.Item
                    key={collection.id}
                    title={`Collection #${collection.id.slice(0, 8)}`}
                    description={`${address} • ${collection.collected_at ? new Date(collection.collected_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "N/A"}`}
                    left={(props) => (
                      <Avatar.Icon
                        {...props}
                        size={40}
                        icon="check-circle"
                        style={styles.completedIcon}
                      />
                    )}
                  />
                );
              })
            ) : (
              <Text variant="bodyMedium" style={styles.noData}>
                No collections completed yet
              </Text>
            )}
          </Card.Content>
        </Card>

        {/* Pending Collections */}
        {pending.length > 0 && (
          <Card style={styles.listCard}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Pending Collections
              </Text>
              <Divider style={styles.divider} />

              {pending.map((collection) => {
                const addressParts = [collection.address_line, collection.city].filter(Boolean);
                const address = addressParts.length > 0 ? addressParts[0] : "Address not provided";
                return (
                  <List.Item
                    key={collection.id}
                    title={`Collection #${collection.id.slice(0, 8)}`}
                    description={address}
                    left={(props) => (
                      <Avatar.Icon
                        {...props}
                        size={40}
                        icon="clock"
                        style={styles.pendingIcon}
                      />
                    )}
                    right={() => (
                      <Button
                        mode="outlined"
                        compact
                        onPress={() =>
                          navigation.navigate("CollectionDetail", { orderId: collection.id })
                        }
                      >
                        View
                      </Button>
                    )}
                  />
                );
              })}
            </Card.Content>
          </Card>
        )}

        {/* Handover Section */}
        <Card style={styles.handoverCard}>
          <Card.Content>
            <View style={styles.handoverHeader}>
              <Avatar.Icon size={40} icon="hand-extended" style={styles.handoverIcon} />
              <Text variant="titleMedium">Sample Handover</Text>
            </View>
            <Text variant="bodyMedium" style={styles.handoverText}>
              All collected samples must be handed over to the lab reception with proper
              chain-of-custody documentation.
            </Text>
            <View style={styles.handoverChips}>
              <Chip icon="check">Cold chain maintained</Chip>
              <Chip icon="check">Labels verified</Chip>
            </View>
          </Card.Content>
        </Card>

        {/* End Trip Button */}
        <Button
          mode="contained"
          onPress={() => setEndTripDialogVisible(true)}
          style={styles.endTripButton}
          contentStyle={styles.endTripButtonContent}
          icon="flag-checkered"
          disabled={pending.length > 0}
        >
          End Trip & Submit Report
        </Button>

        {pending.length > 0 && (
          <Text variant="labelSmall" style={styles.pendingWarning}>
            Complete all pending collections before ending the trip
          </Text>
        )}
      </ScrollView>

      {/* End Trip Dialog */}
      <Portal>
        <Dialog visible={endTripDialogVisible} onDismiss={() => setEndTripDialogVisible(false)}>
          <Dialog.Title>End Trip</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={styles.dialogText}>
              You are about to end today's collection trip. Please enter the total distance
              traveled.
            </Text>
            <TextInput
              mode="outlined"
              label="Total Distance (km)"
              value={totalDistance}
              onChangeText={setTotalDistance}
              keyboardType="decimal-pad"
              style={styles.distanceInput}
              left={<TextInput.Icon icon="map-marker-distance" />}
            />
            <View style={styles.dialogSummary}>
              <Text variant="labelMedium">Trip Summary:</Text>
              <Text variant="bodySmall">• {completed.length} collections completed</Text>
              <Text variant="bodySmall">• {estimatedSamples} samples collected</Text>
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setEndTripDialogVisible(false)}>Cancel</Button>
            <Button
              mode="contained"
              onPress={handleEndTrip}
            >
              End Trip
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
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  summaryCard: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
  },
  summaryTitle: {
    fontWeight: "bold",
    textAlign: "center",
  },
  summaryDate: {
    opacity: 0.6,
    textAlign: "center",
    marginTop: 4,
    marginBottom: 20,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 20,
  },
  statItem: {
    width: "50%",
    alignItems: "center",
    paddingVertical: 12,
  },
  statValue: {
    fontWeight: "bold",
  },
  statLabel: {
    opacity: 0.6,
    marginTop: 4,
  },
  progressSection: {
    backgroundColor: "#f8f9fa",
    padding: 12,
    borderRadius: 8,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  progressPercent: {
    fontWeight: "bold",
    color: "#40c057",
  },
  progressBar: {
    height: 8,
    backgroundColor: "#e9ecef",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#40c057",
    borderRadius: 4,
  },
  samplesCard: {
    borderRadius: 12,
    marginBottom: 16,
    backgroundColor: "#e7f5ff",
  },
  samplesHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  samplesIcon: {
    backgroundColor: "#228be6",
  },
  samplesInfo: {},
  samplesCount: {
    fontWeight: "bold",
    color: "#228be6",
  },
  listCard: {
    borderRadius: 12,
    marginBottom: 16,
  },
  sectionTitle: {
    fontWeight: "600",
  },
  divider: {
    marginVertical: 12,
  },
  completedIcon: {
    backgroundColor: "#d3f9d8",
  },
  pendingIcon: {
    backgroundColor: "#fff3bf",
  },
  noData: {
    opacity: 0.6,
    textAlign: "center",
    padding: 16,
  },
  handoverCard: {
    borderRadius: 12,
    marginBottom: 16,
    backgroundColor: "#fff3bf",
  },
  handoverHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  handoverIcon: {
    backgroundColor: "#fab005",
  },
  handoverText: {
    lineHeight: 22,
    marginBottom: 12,
  },
  handoverChips: {
    flexDirection: "row",
    gap: 8,
  },
  endTripButton: {
    borderRadius: 12,
  },
  endTripButtonContent: {
    paddingVertical: 8,
  },
  pendingWarning: {
    textAlign: "center",
    color: "#fa5252",
    marginTop: 8,
  },
  dialogText: {
    marginBottom: 16,
  },
  distanceInput: {
    marginBottom: 16,
  },
  dialogSummary: {
    backgroundColor: "#f8f9fa",
    padding: 12,
    borderRadius: 8,
  },
});
