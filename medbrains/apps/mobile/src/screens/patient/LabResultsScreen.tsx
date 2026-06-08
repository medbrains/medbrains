import { useAuthStore } from "@medbrains/stores";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
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
import { patientService } from "../../services/patient.service";
import {
  mobileLabOrderStatusText,
  mobileLabPriorityText,
  mobileLabResultsText,
} from "./labResultsText";

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
      return "#10b981";
    case "processing":
      return "#0F766E";
    case "collected":
      return "#fab005";
    case "pending":
      return "#868e96";
    default:
      return "#868e96";
  }
}

function handleFilterValueChange(value: string, setFilter: (filter: FilterType) => void) {
  if (value === "all" || value === "pending" || value === "completed") {
    setFilter(value);
  }
}

function emptyFilterMessage(filter: FilterType): string {
  switch (filter) {
    case "all":
      return mobileLabResultsText("patientLabResults.empty.all");
    case "pending":
      return mobileLabResultsText("patientLabResults.empty.pending");
    case "completed":
      return mobileLabResultsText("patientLabResults.empty.completed");
  }
}

function resultReadyText(count: number): string {
  return mobileLabResultsText(
    count === 1
      ? "patientLabResults.preview.resultReadySingular"
      : "patientLabResults.preview.resultReadyPlural",
    { count },
  );
}

export function LabResultsScreen({ navigation }: LabResultsScreenProps) {
  const theme = useTheme();
  const { user } = useAuthStore();

  const [filter, setFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["patient", "labOrders", user?.id, filter],
    queryFn: () => patientService.listPatientLabOrders(user?.id || ""),
    enabled: Boolean(user?.id),
  });

  // Filter by status and search
  const allOrders = data || [];
  const filteredByStatus =
    filter === "all"
      ? allOrders
      : allOrders.filter((order) => {
          if (filter === "pending")
            return order.status !== "completed" && order.status !== "verified";
          if (filter === "completed")
            return order.status === "completed" || order.status === "verified";
          return true;
        });

  const labOrders = filteredByStatus.filter(
    (order) => !search || order.test_name?.toLowerCase().includes(search.toLowerCase()),
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
              style={[styles.orderIcon, { backgroundColor: isReady ? "#d3f9d8" : "#e7f5ff" }]}
              color={isReady ? "#10b981" : "#0F766E"}
            />
            <View style={styles.orderInfo}>
              <Text variant="titleMedium" style={styles.testName}>
                {item.test_name || mobileLabResultsText("patientLabResults.fallback.testName")}
              </Text>
              <Text variant="bodySmall" style={styles.orderDate}>
                {mobileLabResultsText("patientLabResults.date.line", {
                  date: orderDate.toLocaleDateString(),
                  time: orderDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                })}
              </Text>
              <View style={styles.orderMeta}>
                <Chip
                  compact
                  style={{ backgroundColor: `${statusColor}20` }}
                  textStyle={{ color: statusColor }}
                >
                  {mobileLabOrderStatusText(item.status)}
                </Chip>
                {item.priority && item.priority !== "routine" && (
                  <Chip compact icon="alert" style={styles.priorityChip}>
                    {mobileLabPriorityText(item.priority)}
                  </Chip>
                )}
              </View>
            </View>
            <Avatar.Icon size={24} icon="chevron-right" style={styles.chevron} />
          </Card.Content>

          {/* Results Preview */}
          {isReady && item.result_count != null && item.result_count > 0 && (
            <Card.Content style={styles.resultPreview}>
              <Text variant="labelSmall" style={styles.previewLabel}>
                {mobileLabResultsText("patientLabResults.preview.available")}
              </Text>
              <Text variant="bodySmall">{resultReadyText(item.result_count)}</Text>
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
                {mobileLabResultsText("patientLabResults.action.downloadReport")}
              </Chip>
              <Chip
                icon="share"
                onPress={() => {
                  // Handle share
                }}
              >
                {mobileLabResultsText("patientLabResults.action.share")}
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
          placeholder={mobileLabResultsText("patientLabResults.search.placeholder")}
          value={search}
          onChangeText={setSearch}
          style={styles.searchbar}
        />
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <SegmentedButtons
          value={filter}
          onValueChange={(value) => handleFilterValueChange(value, setFilter)}
          buttons={[
            { value: "all", label: mobileLabResultsText("patientLabResults.filter.all") },
            {
              value: "pending",
              label: mobileLabResultsText("patientLabResults.filter.pending"),
            },
            {
              value: "completed",
              label: mobileLabResultsText("patientLabResults.filter.completed"),
            },
          ]}
        />
      </View>

      {/* Lab Orders List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <Text variant="bodyMedium" style={styles.loadingText}>
            {mobileLabResultsText("patientLabResults.loading.list")}
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
            {mobileLabResultsText("patientLabResults.empty.title")}
          </Text>
          <Text variant="bodyMedium" style={styles.emptyText}>
            {emptyFilterMessage(filter)}
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
              {mobileLabResultsText("patientLabResults.stats.total")}
            </Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text variant="titleLarge" style={[styles.statValue, { color: "#fab005" }]}>
              {allOrders.filter((i) => i.status !== "completed" && i.status !== "verified").length}
            </Text>
            <Text variant="labelSmall" style={styles.statLabel}>
              {mobileLabResultsText("patientLabResults.stats.pending")}
            </Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text variant="titleLarge" style={[styles.statValue, { color: "#10b981" }]}>
              {allOrders.filter((i) => i.status === "completed" || i.status === "verified").length}
            </Text>
            <Text variant="labelSmall" style={styles.statLabel}>
              {mobileLabResultsText("patientLabResults.stats.ready")}
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
