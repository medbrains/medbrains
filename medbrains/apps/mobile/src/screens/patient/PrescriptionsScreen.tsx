import { api } from "@medbrains/api";
import { useAuthStore } from "@medbrains/stores";
import type { PrescriptionHistoryItem, PrescriptionItem } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import React, { useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Avatar,
  Badge,
  Button,
  Card,
  Chip,
  Dialog,
  Divider,
  Portal,
  Searchbar,
  SegmentedButtons,
  Surface,
  Text,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

type FilterType = "recent" | "all";

export function PrescriptionsScreen() {
  const theme = useTheme();
  const { user } = useAuthStore();

  const [filter, setFilter] = useState<FilterType>("recent");
  const [search, setSearch] = useState("");
  const [selectedItem, setSelectedItem] = useState<PrescriptionItem | null>(null);
  const [refillDialogVisible, setRefillDialogVisible] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["patient", "prescriptions", user?.id],
    queryFn: () => api.listPatientPrescriptions(user?.id || ""),
    enabled: Boolean(user?.id),
  });

  // Flatten to get all prescription items with metadata for searching/filtering
  const allPrescriptions = data || [];

  // For "recent", show prescriptions from last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const filteredPrescriptions = filter === "recent"
    ? allPrescriptions.filter((rx) => new Date(rx.encounter_date) >= thirtyDaysAgo)
    : allPrescriptions;

  // Search filter
  const searchedPrescriptions = filteredPrescriptions.filter((rx) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      rx.doctor_name?.toLowerCase().includes(searchLower) ||
      rx.items.some((item) =>
        item.drug_name.toLowerCase().includes(searchLower)
      )
    );
  });

  const handleRefillRequest = (item: PrescriptionItem) => {
    setSelectedItem(item);
    setRefillDialogVisible(true);
  };

  const renderPrescriptionCard = ({ item }: { item: PrescriptionHistoryItem }) => {
    const prescriptionDate = new Date(item.encounter_date);
    const isRecent = prescriptionDate >= thirtyDaysAgo;

    return (
      <Card style={styles.prescriptionCard}>
        <Card.Content>
          {/* Prescription Header */}
          <View style={styles.cardHeader}>
            <View style={styles.dateBox}>
              <Text style={styles.dateDay}>{prescriptionDate.getDate()}</Text>
              <Text style={styles.dateMonth}>
                {prescriptionDate.toLocaleString("en", { month: "short" })}
              </Text>
            </View>
            <View style={styles.headerInfo}>
              <Text variant="titleMedium" style={styles.doctorName}>
                {item.doctor_name || "Doctor"}
              </Text>
              <Text variant="bodySmall" style={styles.prescriptionDate}>
                {prescriptionDate.toLocaleDateString()}
              </Text>
              <Chip compact style={isRecent ? styles.recentChip : undefined}>
                {item.items.length} medication{item.items.length > 1 ? "s" : ""}
              </Chip>
            </View>
          </View>

          <Divider style={styles.divider} />

          {/* Medication Items */}
          {item.items.map((medication) => (
            <View key={medication.id} style={styles.medicationRow}>
              <Avatar.Icon
                size={36}
                icon="pill"
                style={styles.drugIcon}
                color="#228be6"
              />
              <View style={styles.medicationInfo}>
                <Text variant="titleSmall" style={styles.drugName}>
                  {medication.drug_name}
                </Text>
                <View style={styles.dosageMeta}>
                  <Text variant="bodySmall" style={styles.dosageText}>
                    {medication.dosage} • {medication.frequency}
                  </Text>
                </View>
                <Text variant="bodySmall" style={styles.durationText}>
                  {medication.route ? `${medication.route} • ` : ""}{medication.duration}
                </Text>
                {medication.instructions && (
                  <Text variant="bodySmall" style={styles.instructionsText}>
                    {medication.instructions}
                  </Text>
                )}
              </View>
              {isRecent && (
                <Button
                  mode="text"
                  compact
                  onPress={() => handleRefillRequest(medication)}
                >
                  Refill
                </Button>
              )}
            </View>
          ))}
        </Card.Content>
      </Card>
    );
  };

  // Count total medications
  const totalMedications = searchedPrescriptions.reduce(
    (sum, rx) => sum + rx.items.length,
    0
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Searchbar
          placeholder="Search medications or doctors..."
          value={search}
          onChangeText={setSearch}
          style={styles.searchbar}
        />
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <SegmentedButtons
          value={filter}
          onValueChange={(v) => setFilter(v as FilterType)}
          buttons={[
            { value: "recent", label: "Last 30 Days" },
            { value: "all", label: "All History" },
          ]}
        />
      </View>

      {/* Prescriptions List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <Text variant="bodyMedium" style={styles.loadingText}>
            Loading prescriptions...
          </Text>
        </View>
      ) : searchedPrescriptions.length > 0 ? (
        <FlatList
          data={searchedPrescriptions}
          keyExtractor={(item) => item.prescription.id}
          renderItem={renderPrescriptionCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onRefresh={refetch}
          refreshing={isLoading}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Avatar.Icon size={64} icon="pill-off" style={styles.emptyIcon} />
          <Text variant="titleMedium" style={styles.emptyTitle}>
            No prescriptions
          </Text>
          <Text variant="bodyMedium" style={styles.emptyText}>
            {filter === "recent"
              ? "No prescriptions in the last 30 days"
              : "No prescription history found"}
          </Text>
        </View>
      )}

      {/* Summary Banner */}
      {searchedPrescriptions.length > 0 && (
        <Surface style={styles.summaryBanner} elevation={2}>
          <Avatar.Icon size={32} icon="pill" style={styles.bannerIcon} />
          <View style={styles.bannerInfo}>
            <Text variant="labelMedium">Prescription History</Text>
            <Text variant="bodySmall" style={styles.bannerHint}>
              {searchedPrescriptions.length} prescription{searchedPrescriptions.length > 1 ? "s" : ""}
            </Text>
          </View>
          <Badge size={28} style={styles.countBadge}>
            {totalMedications}
          </Badge>
        </Surface>
      )}

      {/* Refill Request Dialog */}
      <Portal>
        <Dialog visible={refillDialogVisible} onDismiss={() => setRefillDialogVisible(false)}>
          <Dialog.Title>Request Refill</Dialog.Title>
          <Dialog.Content>
            {selectedItem && (
              <View style={styles.dialogContent}>
                <Text variant="titleMedium">{selectedItem.drug_name}</Text>
                <Text variant="bodyMedium" style={styles.dialogDosage}>
                  {selectedItem.dosage} • {selectedItem.frequency}
                </Text>
                <Divider style={styles.dialogDivider} />
                <Text variant="bodyMedium">
                  A refill request will be sent to your prescribing doctor. You will be
                  notified when your prescription is ready for pickup.
                </Text>
              </View>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setRefillDialogVisible(false)}>Cancel</Button>
            <Button
              mode="contained"
              onPress={() => {
                // TODO: Submit refill request
                setRefillDialogVisible(false);
              }}
            >
              Submit Request
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchContainer: {
    padding: 16,
    paddingBottom: 8,
  },
  searchbar: {
    borderRadius: 12,
  },
  filterContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  listContent: {
    padding: 16,
    paddingTop: 0,
    paddingBottom: 100,
  },
  prescriptionCard: {
    marginBottom: 16,
    borderRadius: 12,
  },
  cardHeader: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 8,
  },
  dateBox: {
    backgroundColor: "#e7f5ff",
    borderRadius: 8,
    padding: 10,
    alignItems: "center",
    minWidth: 52,
  },
  dateDay: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#228be6",
  },
  dateMonth: {
    fontSize: 11,
    color: "#228be6",
    textTransform: "uppercase",
  },
  headerInfo: {
    flex: 1,
  },
  doctorName: {
    fontWeight: "600",
  },
  prescriptionDate: {
    opacity: 0.6,
    marginTop: 2,
    marginBottom: 6,
  },
  recentChip: {
    backgroundColor: "#d3f9d8",
  },
  divider: {
    marginVertical: 12,
  },
  medicationRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f3f5",
  },
  drugIcon: {
    backgroundColor: "#e7f5ff",
  },
  medicationInfo: {
    flex: 1,
  },
  drugName: {
    fontWeight: "600",
  },
  dosageMeta: {
    marginTop: 2,
  },
  dosageText: {
    color: "#495057",
  },
  durationText: {
    opacity: 0.7,
    marginTop: 2,
  },
  instructionsText: {
    opacity: 0.6,
    fontStyle: "italic",
    marginTop: 4,
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
  summaryBanner: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    gap: 12,
  },
  bannerIcon: {
    backgroundColor: "#e7f5ff",
  },
  bannerInfo: {
    flex: 1,
  },
  bannerHint: {
    opacity: 0.6,
  },
  countBadge: {
    backgroundColor: "#228be6",
  },
  dialogContent: {
    gap: 8,
  },
  dialogDosage: {
    opacity: 0.7,
  },
  dialogDivider: {
    marginVertical: 12,
  },
});
