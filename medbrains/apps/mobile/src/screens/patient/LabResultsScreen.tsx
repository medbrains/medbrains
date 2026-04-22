import { api } from "@medbrains/api";
import { useAuthStore } from "@medbrains/stores";
import { useQuery } from "@tanstack/react-query";
import React, { useState } from "react";
import { FlatList, StyleSheet, TouchableOpacity, View } from "react-native";
import {
  ActivityIndicator,
  Avatar,
  Card,
  Chip,
  Searchbar,
  SegmentedButtons,
  Surface,
  Text,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

type FilterType = "all" | "pending" | "completed";

interface LabResultsScreenProps {
  navigation: {
    navigate: (screen: string, params?: Record<string, unknown>) => void;
  };
}

function getStatusColor(status: string): string {
  switch (status) {
    case "completed":
    case "verified":
      return "#40c057";
    case "processing":
      return "#228be6";
    case "collected":
      return "#fab005";
    case "pending":
      return "#868e96";
    default:
      return "#868e96";
  }
}

export function LabResultsScreen({ navigation }: LabResultsScreenProps) {
  const theme = useTheme();
  const { user } = useAuthStore();

  const [filter, setFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["patient", "labOrders", user?.id, filter],
    queryFn: () => api.listPatientLabOrders(user?.id || ""),
    enabled: Boolean(user?.id),
  });

  // Filter by status and search
  const allOrders = data || [];
  const filteredByStatus = filter === "all"
    ? allOrders
    : allOrders.filter((order) => {
        if (filter === "pending") return order.status !== "completed" && order.status !== "verified";
        if (filter === "completed") return order.status === "completed" || order.status === "verified";
        return true;
      });

  const labOrders = filteredByStatus.filter(
    (order) =>
      !search ||
      order.test_name?.toLowerCase().includes(search.toLowerCase())
  );

  const renderLabOrder = ({ item }: { item: (typeof labOrders)[0] }) => {
    const orderDate = new Date(item.created_at);
    const statusColor = getStatusColor(item.status);
    const isReady = item.status === "completed" || item.status === "verified";

    return (
      <TouchableOpacity
        onPress={() => navigation.navigate("LabResultDetail", { orderId: item.id })}
      >
        <Card style={styles.orderCard}>
          <Card.Content style={styles.cardContent}>
            <Avatar.Icon
              size={48}
              icon={isReady ? "flask-empty" : "flask"}
              style={[
                styles.orderIcon,
                { backgroundColor: isReady ? "#d3f9d8" : "#e7f5ff" },
              ]}
              color={isReady ? "#40c057" : "#228be6"}
            />
            <View style={styles.orderInfo}>
              <Text variant="titleMedium" style={styles.testName}>
                {item.test_name || "Lab Test"}
              </Text>
              <Text variant="bodySmall" style={styles.orderDate}>
                {orderDate.toLocaleDateString()} at {orderDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </Text>
              <View style={styles.orderMeta}>
                <Chip
                  compact
                  style={{ backgroundColor: `${statusColor}20` }}
                  textStyle={{ color: statusColor }}
                >
                  {item.status}
                </Chip>
                {item.priority && item.priority !== "routine" && (
                  <Chip
                    compact
                    icon="alert"
                    style={styles.priorityChip}
                  >
                    {item.priority.toUpperCase()}
                  </Chip>
                )}
              </View>
            </View>
            <Avatar.Icon
              size={24}
              icon="chevron-right"
              style={styles.chevron}
            />
          </Card.Content>

          {/* Results Preview */}
          {isReady && item.result_count != null && item.result_count > 0 && (
            <Card.Content style={styles.resultPreview}>
              <Text variant="labelSmall" style={styles.previewLabel}>
                Results Available
              </Text>
              <Text variant="bodySmall">
                {item.result_count} result{item.result_count > 1 ? "s" : ""} ready
              </Text>
            </Card.Content>
          )}

          {/* Download Button */}
          {isReady && (
            <Card.Actions style={styles.cardActions}>
              <Chip
                icon="download"
                onPress={() => {
                  // Handle PDF download
                }}
              >
                Download Report
              </Chip>
              <Chip
                icon="share"
                onPress={() => {
                  // Handle share
                }}
              >
                Share
              </Chip>
            </Card.Actions>
          )}
        </Card>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Searchbar
          placeholder="Search lab tests..."
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
            { value: "all", label: "All" },
            { value: "pending", label: "Pending" },
            { value: "completed", label: "Completed" },
          ]}
        />
      </View>

      {/* Lab Orders List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <Text variant="bodyMedium" style={styles.loadingText}>
            Loading lab results...
          </Text>
        </View>
      ) : labOrders.length > 0 ? (
        <FlatList
          data={labOrders}
          keyExtractor={(item) => item.id}
          renderItem={renderLabOrder}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onRefresh={refetch}
          refreshing={isLoading}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Avatar.Icon size={64} icon="flask-empty-outline" style={styles.emptyIcon} />
          <Text variant="titleMedium" style={styles.emptyTitle}>
            No lab results
          </Text>
          <Text variant="bodyMedium" style={styles.emptyText}>
            {filter === "all"
              ? "You have no lab orders"
              : filter === "pending"
                ? "No pending lab orders"
                : "No completed lab results"}
          </Text>
        </View>
      )}

      {/* Quick Stats */}
      {allOrders.length > 0 && (
        <Surface style={styles.statsBar} elevation={2}>
          <View style={styles.statItem}>
            <Text variant="titleLarge" style={styles.statValue}>
              {allOrders.length}
            </Text>
            <Text variant="labelSmall" style={styles.statLabel}>
              Total
            </Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text variant="titleLarge" style={[styles.statValue, { color: "#fab005" }]}>
              {allOrders.filter((i) => i.status !== "completed" && i.status !== "verified").length}
            </Text>
            <Text variant="labelSmall" style={styles.statLabel}>
              Pending
            </Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text variant="titleLarge" style={[styles.statValue, { color: "#40c057" }]}>
              {allOrders.filter((i) => i.status === "completed" || i.status === "verified").length}
            </Text>
            <Text variant="labelSmall" style={styles.statLabel}>
              Ready
            </Text>
          </View>
        </Surface>
      )}
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
  orderCard: {
    marginBottom: 12,
    borderRadius: 12,
  },
  cardContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  orderIcon: {
    backgroundColor: "#e7f5ff",
  },
  orderInfo: {
    flex: 1,
  },
  testName: {
    fontWeight: "600",
  },
  orderDate: {
    opacity: 0.6,
    marginTop: 2,
  },
  orderMeta: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  priorityChip: {
    backgroundColor: "#ffe3e3",
  },
  chevron: {
    backgroundColor: "transparent",
  },
  resultPreview: {
    backgroundColor: "#f8f9fa",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#e9ecef",
  },
  previewLabel: {
    opacity: 0.6,
    marginBottom: 4,
  },
  cardActions: {
    paddingTop: 8,
    gap: 8,
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
  statsBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    padding: 16,
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontWeight: "bold",
  },
  statLabel: {
    opacity: 0.6,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: "#e9ecef",
  },
});
