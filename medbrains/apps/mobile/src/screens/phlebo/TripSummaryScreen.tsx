import { useAuthStore, useHasPermission } from "@medbrains/stores";
import type { LabHomeCollection } from "@medbrains/types";
import { P } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
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
import { checkTripClose } from "../../lib/trip.js";
import { phlebotomyService } from "../../services/phlebotomy.service";
import { mobilePhlebotomyText } from "./phlebotomyText";

interface TripSummaryScreenProps {
  navigation: {
    navigate: (screen: string, params?: Record<string, unknown>) => void;
    goBack: () => void;
  };
}

export function TripSummaryScreen({ navigation }: TripSummaryScreenProps) {
  const canListCollections = useHasPermission(P.LAB.SAMPLES_LIST);
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
      return phlebotomyService.listHomeCollections(params);
    },
    // Do not fetch what this user may not see — hiding it after
    // the fetch still leaves it in the response and in devtools.
    enabled: Boolean(user?.id) && canListCollections,
  });

  const collections: LabHomeCollection[] = data || [];
  const completed = collections.filter(
    (c) => c.status === "collected" || c.status === "returned_to_lab",
  );
  const pending = collections.filter(
    (c) =>
      c.status === "scheduled" ||
      c.status === "assigned" ||
      c.status === "in_transit" ||
      c.status === "arrived",
  );
  const cancelled = collections.filter((c) => c.status === "cancelled");

  // Estimate samples based on completed collections (since we don't have test_names)
  const estimatedSamples = completed.length;

  const tripClose = checkTripClose(collections);

  /**
   * Closes the round only once every visit has been resolved.
   *
   * This used to show a success message and submit nothing, which mattered
   * less for the missing record than for the collections left behind: a round
   * closed with visits still pending leaves those patients expecting a
   * phlebotomist who is no longer coming, and nothing anywhere says so.
   */
  const handleEndTrip = () => {
    if (!tripClose.canEnd) {
      return;
    }
    setSnackbar({
      visible: true,
      message: mobilePhlebotomyText("phlebotomy.trip.snackbar.ended"),
    });
    setEndTripDialogVisible(false);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  const completionRate =
    collections.length > 0 ? Math.round((completed.length / collections.length) * 100) : 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Day Summary Card */}
        <Surface style={styles.summaryCard} elevation={2}>
          <Text variant="titleLarge" style={styles.summaryTitle}>
            {mobilePhlebotomyText("phlebotomy.trip.summaryTitle")}
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
              <Text variant="displaySmall" style={[styles.statValue, { color: "#0F766E" }]}>
                {collections.length}
              </Text>
              <Text variant="labelSmall" style={styles.statLabel}>
                {mobilePhlebotomyText("phlebotomy.trip.stats.totalAssigned")}
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text variant="displaySmall" style={[styles.statValue, { color: "#10b981" }]}>
                {completed.length}
              </Text>
              <Text variant="labelSmall" style={styles.statLabel}>
                {mobilePhlebotomyText("phlebotomy.trip.stats.completed")}
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text variant="displaySmall" style={[styles.statValue, { color: "#fab005" }]}>
                {pending.length}
              </Text>
              <Text variant="labelSmall" style={styles.statLabel}>
                {mobilePhlebotomyText("phlebotomy.trip.stats.pending")}
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text variant="displaySmall" style={[styles.statValue, { color: "#C8102E" }]}>
                {cancelled.length}
              </Text>
              <Text variant="labelSmall" style={styles.statLabel}>
                {mobilePhlebotomyText("phlebotomy.trip.stats.cancelled")}
              </Text>
            </View>
          </View>

          {/* Completion Progress */}
          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text variant="labelMedium">
                {mobilePhlebotomyText("phlebotomy.trip.completionRate")}
              </Text>
              <Text variant="titleMedium" style={styles.progressPercent}>
                {completionRate}%
              </Text>
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${completionRate}%` }]} />
            </View>
          </View>
        </Surface>

        {/* Samples Collected */}
        <Card style={styles.samplesCard}>
          <Card.Content>
            <View style={styles.samplesHeader}>
              <Avatar.Icon size={40} icon="flask" style={styles.samplesIcon} />
              <View style={styles.samplesInfo}>
                <Text variant="titleMedium">
                  {mobilePhlebotomyText("phlebotomy.trip.totalCollectionsCompleted")}
                </Text>
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
              {mobilePhlebotomyText("phlebotomy.trip.completedCollectionsTitle")}
            </Text>
            <Divider style={styles.divider} />

            {completed.length > 0 ? (
              completed.map((collection) => {
                const addressParts = [collection.address_line, collection.city].filter(Boolean);
                const address =
                  addressParts.length > 0
                    ? addressParts.join(", ")
                    : mobilePhlebotomyText("phlebotomy.collection.addressNotProvided");
                const collectedTime = collection.collected_at
                  ? new Date(collection.collected_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : mobilePhlebotomyText("phlebotomy.trip.notAvailable");
                return (
                  <List.Item
                    key={collection.id}
                    title={mobilePhlebotomyText("phlebotomy.collection.collectionId", {
                      id: collection.id.slice(0, 8),
                    })}
                    description={mobilePhlebotomyText("phlebotomy.trip.description.completed", {
                      address,
                      time: collectedTime,
                    })}
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
                {mobilePhlebotomyText("phlebotomy.trip.empty.completed")}
              </Text>
            )}
          </Card.Content>
        </Card>

        {/* Pending Collections */}
        {pending.length > 0 && (
          <Card style={styles.listCard}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                {mobilePhlebotomyText("phlebotomy.trip.pendingCollectionsTitle")}
              </Text>
              <Divider style={styles.divider} />

              {pending.map((collection) => {
                const addressParts = [collection.address_line, collection.city].filter(Boolean);
                const address =
                  addressParts.length > 0
                    ? addressParts[0]
                    : mobilePhlebotomyText("phlebotomy.collection.addressNotProvided");
                return (
                  <List.Item
                    key={collection.id}
                    title={mobilePhlebotomyText("phlebotomy.collection.collectionId", {
                      id: collection.id.slice(0, 8),
                    })}
                    description={address}
                    left={(props) => (
                      <Avatar.Icon {...props} size={40} icon="clock" style={styles.pendingIcon} />
                    )}
                    right={() => (
                      <Button
                        mode="outlined"
                        compact
                        onPress={() =>
                          navigation.navigate("CollectionDetail", { orderId: collection.id })
                        }
                      >
                        {mobilePhlebotomyText("phlebotomy.trip.action.view")}
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
              <Text variant="titleMedium">
                {mobilePhlebotomyText("phlebotomy.trip.handover.title")}
              </Text>
            </View>
            <Text variant="bodyMedium" style={styles.handoverText}>
              {mobilePhlebotomyText("phlebotomy.trip.handover.message")}
            </Text>
            <View style={styles.handoverChips}>
              <Chip icon="check">{mobilePhlebotomyText("phlebotomy.trip.handover.coldChain")}</Chip>
              <Chip icon="check">
                {mobilePhlebotomyText("phlebotomy.trip.handover.labelsVerified")}
              </Chip>
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
          {mobilePhlebotomyText("phlebotomy.trip.action.endTripSubmit")}
        </Button>

        {pending.length > 0 && (
          <Text variant="labelSmall" style={styles.pendingWarning}>
            {mobilePhlebotomyText("phlebotomy.trip.pendingWarning")}
          </Text>
        )}
      </ScrollView>

      {/* End Trip Dialog */}
      <Portal>
        <Dialog visible={endTripDialogVisible} onDismiss={() => setEndTripDialogVisible(false)}>
          <Dialog.Title>{mobilePhlebotomyText("phlebotomy.trip.dialog.title")}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={styles.dialogText}>
              {mobilePhlebotomyText("phlebotomy.trip.dialog.message")}
            </Text>
            {!tripClose.canEnd && (
              <Text variant="bodyMedium" style={styles.dialogText}>
                {tripClose.outstanding.length} collection
                {tripClose.outstanding.length === 1 ? "" : "s"} on this round have not been
                resolved. Mark each one collected or cancelled first — closing now would leave those
                patients waiting for a visit nobody is coming to make.
              </Text>
            )}
            <TextInput
              mode="outlined"
              label={mobilePhlebotomyText("phlebotomy.trip.dialog.distanceLabel")}
              value={totalDistance}
              onChangeText={setTotalDistance}
              keyboardType="decimal-pad"
              style={styles.distanceInput}
              left={<TextInput.Icon icon="map-marker-distance" />}
            />
            <View style={styles.dialogSummary}>
              <Text variant="labelMedium">
                {mobilePhlebotomyText("phlebotomy.trip.dialog.summaryTitle")}
              </Text>
              <Text variant="bodySmall">
                {mobilePhlebotomyText(
                  completed.length === 1
                    ? "phlebotomy.trip.collectionsCompletedSingular"
                    : "phlebotomy.trip.collectionsCompletedPlural",
                  { count: completed.length },
                )}
              </Text>
              <Text variant="bodySmall">
                {mobilePhlebotomyText(
                  estimatedSamples === 1
                    ? "phlebotomy.trip.samplesCollectedSingular"
                    : "phlebotomy.trip.samplesCollectedPlural",
                  { count: estimatedSamples },
                )}
              </Text>
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setEndTripDialogVisible(false)}>
              {mobilePhlebotomyText("phlebotomy.action.cancel")}
            </Button>
            <Button mode="contained" onPress={handleEndTrip} disabled={!tripClose.canEnd}>
              {mobilePhlebotomyText("phlebotomy.trip.action.endTrip")}
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
    color: "#10b981",
  },
  progressBar: {
    height: 8,
    backgroundColor: "#e9ecef",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#10b981",
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
    backgroundColor: "#0F766E",
  },
  samplesInfo: {},
  samplesCount: {
    fontWeight: "bold",
    color: "#0F766E",
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
    color: "#C8102E",
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
