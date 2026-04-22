import { api } from "@medbrains/api";
import { useAuthStore } from "@medbrains/stores";
import type { LabHomeCollection } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import React, { useState } from "react";
import { FlatList, StyleSheet, TouchableOpacity, View } from "react-native";
import {
  ActivityIndicator,
  Avatar,
  Badge,
  Card,
  Chip,
  FAB,
  SegmentedButtons,
  Surface,
  Text,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

type FilterType = "pending" | "collected" | "all";

interface CollectionListScreenProps {
  navigation: {
    navigate: (screen: string, params?: Record<string, unknown>) => void;
  };
}

function getStatusColor(status: string): string {
  switch (status) {
    case "collected":
    case "returned_to_lab":
      return "#40c057";
    case "in_transit":
    case "arrived":
      return "#228be6";
    case "scheduled":
    case "assigned":
      return "#fab005";
    case "cancelled":
      return "#fa5252";
    default:
      return "#868e96";
  }
}

export function CollectionListScreen({ navigation }: CollectionListScreenProps) {
  const theme = useTheme();
  const { user } = useAuthStore();

  const [filter, setFilter] = useState<FilterType>("pending");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["homeCollections", user?.id, filter],
    queryFn: () => {
      const today = new Date().toISOString().split("T")[0] ?? "";
      const params: Record<string, string> = {
        date: today,
      };
      if (user?.id) {
        params.phlebotomist_id = user.id;
      }
      if (filter !== "all") {
        params.status = filter === "pending" ? "assigned" : "collected";
      }
      return api.listHomeCollections(params);
    },
    enabled: Boolean(user?.id),
    refetchInterval: 30000,
  });

  const collections = data || [];
  const pendingCount = collections.filter(
    (c) => c.status === "scheduled" || c.status === "assigned" || c.status === "in_transit" || c.status === "arrived"
  ).length;
  const collectedCount = collections.filter(
    (c) => c.status === "collected" || c.status === "returned_to_lab"
  ).length;

  const renderCollectionCard = ({ item }: { item: LabHomeCollection }) => {
    const statusColor = getStatusColor(item.status);

    const addressParts = [item.address_line, item.city, item.pincode].filter(Boolean);
    const address = addressParts.length > 0 ? addressParts.join(", ") : "Address not provided";

    return (
      <TouchableOpacity
        onPress={() => navigation.navigate("CollectionDetail", { orderId: item.id })}
      >
        <Card style={[styles.collectionCard, { borderLeftColor: statusColor, borderLeftWidth: 4 }]}>
          <Card.Content>
            <View style={styles.cardHeader}>
              <View style={styles.patientInfo}>
                <Text variant="titleMedium" style={styles.collectionId}>
                  Collection #{item.id.slice(0, 8)}
                </Text>
                <Text variant="bodySmall" style={styles.dateText}>
                  {item.scheduled_date}
                </Text>
              </View>
              <Badge
                style={[
                  styles.statusBadge,
                  { backgroundColor: `${statusColor}20` },
                ]}
              >
                {item.status.replace("_", " ")}
              </Badge>
            </View>

            {/* Address */}
            <View style={styles.addressRow}>
              <Avatar.Icon size={24} icon="map-marker" style={styles.addressIcon} />
              <Text variant="bodySmall" style={styles.addressText} numberOfLines={2}>
                {address}
              </Text>
            </View>

            {/* Time & Contact */}
            <View style={styles.timeRow}>
              <Chip icon="clock" compact>
                {item.scheduled_time_slot || "Flexible"}
              </Chip>
              {item.contact_phone && (
                <Chip icon="phone" compact>
                  {item.contact_phone}
                </Chip>
              )}
            </View>

            {/* Special Instructions */}
            {item.special_instructions && (
              <View style={styles.instructionsRow}>
                <Avatar.Icon size={20} icon="information" style={styles.infoIcon} />
                <Text variant="bodySmall" style={styles.instructionsText} numberOfLines={1}>
                  {item.special_instructions}
                </Text>
              </View>
            )}
          </Card.Content>
        </Card>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Stats Header */}
      <View style={styles.statsContainer}>
        <Surface style={styles.statCard} elevation={1}>
          <Text style={[styles.statValue, { color: "#fab005" }]}>{pendingCount}</Text>
          <Text variant="labelSmall" style={styles.statLabel}>Pending</Text>
        </Surface>
        <Surface style={styles.statCard} elevation={1}>
          <Text style={[styles.statValue, { color: "#40c057" }]}>{collectedCount}</Text>
          <Text variant="labelSmall" style={styles.statLabel}>Collected</Text>
        </Surface>
        <Surface style={styles.statCard} elevation={1}>
          <Text style={[styles.statValue, { color: "#228be6" }]}>{collections.length}</Text>
          <Text variant="labelSmall" style={styles.statLabel}>Total</Text>
        </Surface>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <SegmentedButtons
          value={filter}
          onValueChange={(v) => setFilter(v as FilterType)}
          buttons={[
            { value: "pending", label: "Pending" },
            { value: "collected", label: "Collected" },
            { value: "all", label: "All" },
          ]}
        />
      </View>

      {/* Collections List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <Text variant="bodyMedium" style={styles.loadingText}>
            Loading collections...
          </Text>
        </View>
      ) : collections.length > 0 ? (
        <FlatList
          data={collections}
          keyExtractor={(item) => item.id}
          renderItem={renderCollectionCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onRefresh={refetch}
          refreshing={isLoading}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Avatar.Icon size={64} icon="test-tube-empty" style={styles.emptyIcon} />
          <Text variant="titleMedium" style={styles.emptyTitle}>
            No collections
          </Text>
          <Text variant="bodyMedium" style={styles.emptyText}>
            {filter === "pending"
              ? "No pending collections for today"
              : filter === "collected"
                ? "No samples collected yet"
                : "No collections assigned"}
          </Text>
        </View>
      )}

      {/* Navigation FAB */}
      <FAB
        icon="navigation"
        style={styles.fab}
        onPress={() => {
          // Open route navigation
        }}
        label="Navigate"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  statsContainer: {
    flexDirection: "row",
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  statValue: {
    fontSize: 28,
    fontWeight: "bold",
  },
  statLabel: {
    opacity: 0.6,
    marginTop: 4,
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
  collectionCard: {
    marginBottom: 12,
    borderRadius: 12,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  patientInfo: {},
  collectionId: {
    fontWeight: "600",
  },
  dateText: {
    opacity: 0.6,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 12,
    backgroundColor: "#f8f9fa",
    padding: 8,
    borderRadius: 8,
  },
  addressIcon: {
    backgroundColor: "#e7f5ff",
    width: 24,
    height: 24,
  },
  addressText: {
    flex: 1,
    opacity: 0.7,
  },
  timeRow: {
    flexDirection: "row",
    gap: 8,
  },
  instructionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    backgroundColor: "#fff3bf",
    padding: 6,
    borderRadius: 6,
  },
  infoIcon: {
    backgroundColor: "#fab005",
    width: 20,
    height: 20,
  },
  instructionsText: {
    flex: 1,
    opacity: 0.8,
    fontSize: 12,
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
  fab: {
    position: "absolute",
    right: 16,
    bottom: 16,
  },
});
