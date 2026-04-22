import { api } from "@medbrains/api";
import type { LabOrder, LabResult } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import React, { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Avatar,
  Card,
  Chip,
  Divider,
  List,
  SegmentedButtons,
  Surface,
  Text,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

interface LabResultsViewScreenProps {
  route: {
    params: {
      orderId?: string;
      patientId?: string;
    };
  };
}

type ViewMode = "latest" | "history" | "trends";

function parseNormalRange(range: string | null | undefined): { low?: number; high?: number } {
  if (!range) return {};
  // Parse formats like "10-20", "< 100", "> 5", "10 - 20"
  const dashMatch = range.match(/(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)/);
  if (dashMatch && dashMatch[1] && dashMatch[2]) {
    return { low: parseFloat(dashMatch[1]), high: parseFloat(dashMatch[2]) };
  }
  return {};
}

function getResultStatus(value: string, normalRange: string | null): "normal" | "low" | "high" | "critical" {
  const numValue = parseFloat(value);
  if (Number.isNaN(numValue)) return "normal";

  const { low, high } = parseNormalRange(normalRange);

  if (low !== undefined && numValue < low) {
    return numValue < low * 0.7 ? "critical" : "low";
  }
  if (high !== undefined && numValue > high) {
    return numValue > high * 1.3 ? "critical" : "high";
  }
  return "normal";
}

function getStatusColor(status: string): string {
  switch (status) {
    case "normal":
      return "#40c057";
    case "low":
      return "#fab005";
    case "high":
      return "#fd7e14";
    case "critical":
      return "#fa5252";
    default:
      return "#868e96";
  }
}

export function LabResultsViewScreen({ route }: LabResultsViewScreenProps) {
  const theme = useTheme();
  const { orderId, patientId } = route.params;

  const [viewMode, setViewMode] = useState<ViewMode>("latest");

  // getLabOrder returns LabOrderDetailResponse with { order, results }
  const { data: orderDetail, isLoading: orderLoading } = useQuery({
    queryKey: ["lab", "order", orderId],
    queryFn: () => api.getLabOrder(orderId || ""),
    enabled: Boolean(orderId),
  });

  const { data: patientOrders } = useQuery({
    queryKey: ["lab", "orders", patientId, "history"],
    queryFn: () => api.listLabOrders({ patient_id: patientId || "", page: "1", per_page: "10" }),
    enabled: Boolean(patientId) && viewMode === "history",
  });

  const isLoading = orderLoading;

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" />
        <Text variant="bodyMedium" style={styles.loadingText}>
          Loading lab results...
        </Text>
      </SafeAreaView>
    );
  }

  if (!orderDetail) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <Avatar.Icon size={64} icon="flask-empty-outline" style={styles.errorIcon} />
        <Text variant="titleMedium">Lab order not found</Text>
      </SafeAreaView>
    );
  }

  const order: LabOrder = orderDetail.order;
  const results: LabResult[] = orderDetail.results || [];
  const orderStatus = order.status || "pending";
  const hasResults = results.length > 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Order Header */}
        <Surface style={styles.headerCard} elevation={2}>
          <View style={styles.headerRow}>
            <Avatar.Icon
              size={48}
              icon="flask"
              style={[
                styles.headerIcon,
                { backgroundColor: orderStatus === "completed" ? "#d3f9d8" : "#e7f5ff" },
              ]}
              color={orderStatus === "completed" ? "#40c057" : "#228be6"}
            />
            <View style={styles.headerInfo}>
              <Text variant="titleLarge" style={styles.orderTitle}>
                Lab Order
              </Text>
              <Text variant="bodySmall" style={styles.orderDate}>
                {new Date(order.created_at).toLocaleDateString()} at{" "}
                {new Date(order.created_at).toLocaleTimeString()}
              </Text>
            </View>
          </View>

          <View style={styles.statusRow}>
            <Chip
              icon={orderStatus === "completed" ? "check-circle" : "clock"}
              style={[
                styles.statusChip,
                { backgroundColor: orderStatus === "completed" ? "#d3f9d8" : "#fff3bf" },
              ]}
            >
              {orderStatus.charAt(0).toUpperCase() + orderStatus.slice(1)}
            </Chip>

            {order.priority && order.priority !== "routine" && (
              <Chip
                icon="alert"
                style={[
                  styles.priorityChip,
                  { backgroundColor: order.priority === "stat" ? "#ffe3e3" : "#fff3bf" },
                ]}
              >
                {order.priority.toUpperCase()}
              </Chip>
            )}
          </View>

          {order.ordered_by && (
            <Text variant="bodySmall" style={styles.physician}>
              Ordered by: {order.ordered_by}
            </Text>
          )}
        </Surface>

        {/* View Mode Tabs */}
        <SegmentedButtons
          value={viewMode}
          onValueChange={(v) => setViewMode(v as ViewMode)}
          buttons={[
            { value: "latest", label: "Results" },
            { value: "history", label: "History" },
            { value: "trends", label: "Trends" },
          ]}
          style={styles.segmented}
        />

        {/* Results View */}
        {viewMode === "latest" && (
          <>
            {hasResults ? (
              <Card style={styles.resultsCard}>
                <Card.Content>
                  <Text variant="titleMedium" style={styles.sectionTitle}>
                    Test Results
                  </Text>
                  <Divider style={styles.divider} />

                  {results.map((result) => {
                    const status = getResultStatus(result.value, result.normal_range);
                    const statusColor = getStatusColor(status);

                    return (
                      <View key={result.id} style={styles.resultRow}>
                        <View style={styles.resultInfo}>
                          <Text variant="bodyLarge" style={styles.paramName}>
                            {result.parameter_name}
                          </Text>
                          {result.normal_range && (
                            <Text variant="bodySmall" style={styles.refRange}>
                              Ref: {result.normal_range} {result.unit || ""}
                            </Text>
                          )}
                        </View>

                        <View style={styles.resultValue}>
                          <Text
                            variant="titleMedium"
                            style={[styles.valueText, { color: statusColor }]}
                          >
                            {result.value}
                          </Text>
                          {result.unit && (
                            <Text variant="labelSmall" style={styles.unitText}>
                              {result.unit}
                            </Text>
                          )}
                        </View>

                        {status !== "normal" && (
                          <Chip
                            compact
                            style={[styles.statusBadge, { backgroundColor: `${statusColor}20` }]}
                            textStyle={{ color: statusColor }}
                          >
                            {status === "critical" ? "CRITICAL" : status.toUpperCase()}
                          </Chip>
                        )}
                      </View>
                    );
                  })}
                </Card.Content>
              </Card>
            ) : (
              <Surface style={styles.emptyState} elevation={1}>
                <Avatar.Icon size={48} icon="flask-empty" style={styles.emptyIcon} />
                <Text variant="bodyMedium" style={styles.emptyText}>
                  Results pending
                </Text>
                <Text variant="bodySmall" style={styles.emptyHint}>
                  Results will appear here once processing is complete
                </Text>
              </Surface>
            )}

            {/* Notes */}
            {order.notes && (
              <Card style={styles.interpretationCard}>
                <Card.Content>
                  <View style={styles.interpretationHeader}>
                    <Avatar.Icon size={32} icon="text" style={styles.interpretationIcon} />
                    <Text variant="titleSmall">Notes</Text>
                  </View>
                  <Text variant="bodyMedium" style={styles.interpretationText}>
                    {order.notes}
                  </Text>
                </Card.Content>
              </Card>
            )}
          </>
        )}

        {/* History View */}
        {viewMode === "history" && patientOrders?.orders && patientOrders.orders.length > 0 && (
          <Card style={styles.historyCard}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Previous Lab Orders
              </Text>
              <Divider style={styles.divider} />

              {patientOrders.orders.map((historyOrder) => (
                <List.Item
                  key={historyOrder.id}
                  title="Lab Order"
                  description={new Date(historyOrder.created_at).toLocaleDateString()}
                  left={(props) => (
                    <Avatar.Icon
                      {...props}
                      size={40}
                      icon="flask"
                      style={{
                        backgroundColor:
                          historyOrder.status === "completed" ? "#d3f9d8" : "#f1f3f5",
                      }}
                    />
                  )}
                  right={() => (
                    <Chip
                      compact
                      style={
                        historyOrder.status === "completed" ? styles.completedChip : undefined
                      }
                    >
                      {historyOrder.status}
                    </Chip>
                  )}
                />
              ))}
            </Card.Content>
          </Card>
        )}

        {viewMode === "history" && (!patientOrders?.orders || patientOrders.orders.length === 0) && (
          <Surface style={styles.emptyState} elevation={1}>
            <Avatar.Icon size={48} icon="history" style={styles.emptyIcon} />
            <Text variant="bodyMedium" style={styles.emptyText}>
              No previous orders
            </Text>
          </Surface>
        )}

        {/* Trends View */}
        {viewMode === "trends" && (
          <Surface style={styles.trendsPlaceholder} elevation={1}>
            <Avatar.Icon size={48} icon="chart-line" style={styles.trendsIcon} />
            <Text variant="bodyMedium" style={styles.trendsText}>
              Trend analysis coming soon
            </Text>
            <Text variant="bodySmall" style={styles.trendsHint}>
              View historical trends for lab parameters
            </Text>
          </Surface>
        )}
      </ScrollView>
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
    gap: 16,
  },
  loadingText: {
    opacity: 0.6,
  },
  errorIcon: {
    backgroundColor: "#f1f3f5",
    marginBottom: 8,
  },
  scrollContent: {
    padding: 16,
  },
  headerCard: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 12,
  },
  headerIcon: {
    backgroundColor: "#e7f5ff",
  },
  headerInfo: {
    flex: 1,
  },
  orderTitle: {
    fontWeight: "bold",
  },
  orderDate: {
    opacity: 0.6,
    marginTop: 2,
  },
  statusRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  statusChip: {
    height: 28,
  },
  priorityChip: {
    height: 28,
  },
  physician: {
    opacity: 0.6,
    marginTop: 4,
  },
  segmented: {
    marginBottom: 16,
  },
  resultsCard: {
    borderRadius: 12,
    marginBottom: 16,
  },
  sectionTitle: {
    fontWeight: "600",
  },
  divider: {
    marginVertical: 12,
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f3f5",
  },
  resultInfo: {
    flex: 1,
  },
  paramName: {
    fontWeight: "500",
  },
  refRange: {
    opacity: 0.5,
    marginTop: 2,
  },
  resultValue: {
    alignItems: "flex-end",
    marginRight: 12,
  },
  valueText: {
    fontWeight: "bold",
  },
  unitText: {
    opacity: 0.6,
  },
  statusBadge: {
    height: 24,
  },
  emptyState: {
    padding: 32,
    borderRadius: 12,
    alignItems: "center",
    gap: 8,
  },
  emptyIcon: {
    backgroundColor: "#f1f3f5",
  },
  emptyText: {
    opacity: 0.6,
  },
  emptyHint: {
    opacity: 0.4,
    textAlign: "center",
  },
  interpretationCard: {
    borderRadius: 12,
    backgroundColor: "#f8f9fa",
  },
  interpretationHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  interpretationIcon: {
    backgroundColor: "#e7f5ff",
  },
  interpretationText: {
    lineHeight: 22,
  },
  historyCard: {
    borderRadius: 12,
  },
  completedChip: {
    backgroundColor: "#d3f9d8",
  },
  trendsPlaceholder: {
    padding: 48,
    borderRadius: 12,
    alignItems: "center",
    gap: 8,
  },
  trendsIcon: {
    backgroundColor: "#e7f5ff",
  },
  trendsText: {
    opacity: 0.6,
  },
  trendsHint: {
    opacity: 0.4,
  },
});
