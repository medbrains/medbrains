import { useHasPermission } from "@medbrains/stores";
import type { LabOrder, LabOrderStatus, LabPriority, LabResult } from "@medbrains/types";
import { P } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
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
import {
  MOBILE_LAB_ORDER_TEXT,
  MOBILE_LAB_RESULTS_TEXT,
  mobilePatientJourneyText,
} from "../../components/patientJourneyText";
import { clinicalService } from "../../services/clinical.service";

interface LabResultsViewScreenProps {
  route: {
    params: {
      orderId?: string;
      patientId?: string;
    };
  };
}

type ViewMode = "latest" | "history" | "trends";
type ResultStatus = "normal" | "low" | "high" | "critical";

const LAB_ORDER_TEXT = MOBILE_LAB_ORDER_TEXT;
const LAB_RESULTS_TEXT = MOBILE_LAB_RESULTS_TEXT;

const LAB_ORDER_STATUS_LABEL_KEYS: Record<LabOrderStatus, string> = {
  cancelled: LAB_ORDER_TEXT.status.cancelled,
  completed: LAB_ORDER_TEXT.status.completed,
  ordered: LAB_ORDER_TEXT.status.ordered,
  processing: LAB_ORDER_TEXT.status.processing,
  sample_collected: LAB_ORDER_TEXT.status.sampleCollected,
  verified: LAB_ORDER_TEXT.status.verified,
};

const LAB_PRIORITY_LABEL_KEYS: Record<LabPriority, string> = {
  routine: LAB_ORDER_TEXT.priority.routine,
  stat: LAB_ORDER_TEXT.priority.stat,
  urgent: LAB_ORDER_TEXT.priority.urgent,
};

const RESULT_STATUS_LABEL_KEYS: Record<ResultStatus, string> = {
  critical: LAB_RESULTS_TEXT.resultStatus.critical,
  high: LAB_RESULTS_TEXT.resultStatus.high,
  low: LAB_RESULTS_TEXT.resultStatus.low,
  normal: LAB_RESULTS_TEXT.resultStatus.normal,
};

function labResultsText(key: string, values?: Record<string, string | number | boolean>): string {
  return mobilePatientJourneyText(key, values);
}

function labOrderStatusText(status: LabOrderStatus): string {
  return labResultsText(LAB_ORDER_STATUS_LABEL_KEYS[status]);
}

function labPriorityText(priority: LabPriority): string {
  return labResultsText(LAB_PRIORITY_LABEL_KEYS[priority]);
}

function resultStatusText(status: ResultStatus): string {
  return labResultsText(RESULT_STATUS_LABEL_KEYS[status]);
}

function parseNormalRange(range: string | null | undefined): { low?: number; high?: number } {
  if (!range) return {};
  // Parse formats like "10-20", "< 100", "> 5", "10 - 20"
  const dashMatch = range.match(/(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)/);
  if (dashMatch?.[1] && dashMatch[2]) {
    return { low: parseFloat(dashMatch[1]), high: parseFloat(dashMatch[2]) };
  }
  return {};
}

function getResultStatus(value: string, normalRange: string | null): ResultStatus {
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
      return "#10b981";
    case "low":
      return "#fab005";
    case "high":
      return "#fd7e14";
    case "critical":
      return "#C8102E";
    default:
      return "#868e96";
  }
}

export function LabResultsViewScreen({ route }: LabResultsViewScreenProps) {
  const canViewLabOrders = useHasPermission(P.LAB.ORDERS_LIST);
  const theme = useTheme();
  const { orderId, patientId } = route.params;

  const [viewMode, setViewMode] = useState<ViewMode>("latest");

  const { data: orderDetail, isLoading: orderLoading } = useQuery({
    queryKey: ["lab", "order", orderId],
    queryFn: () => clinicalService.getLabOrder(orderId || ""),
    // Do not fetch what this user may not see — hiding it after
    // the fetch still leaves it in the response and in devtools.
    enabled: Boolean(orderId) && canViewLabOrders,
  });

  const { data: patientOrders } = useQuery({
    queryKey: ["lab", "orders", patientId, "history"],
    queryFn: () =>
      clinicalService.listLabOrders({ patient_id: patientId || "", page: "1", per_page: "10" }),
    enabled: Boolean(patientId) && viewMode === "history",
  });

  const isLoading = orderLoading;

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" />
        <Text variant="bodyMedium" style={styles.loadingText}>
          {labResultsText(LAB_RESULTS_TEXT.loading.results)}
        </Text>
      </SafeAreaView>
    );
  }

  if (!orderDetail) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <Avatar.Icon size={64} icon="flask-empty-outline" style={styles.errorIcon} />
        <Text variant="titleMedium">{labResultsText(LAB_RESULTS_TEXT.empty.noOrder)}</Text>
      </SafeAreaView>
    );
  }

  const order: LabOrder = orderDetail.order;
  const results: LabResult[] = orderDetail.results || [];
  const orderStatus = order.status;
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
              color={orderStatus === "completed" ? "#10b981" : "#0F766E"}
            />
            <View style={styles.headerInfo}>
              <Text variant="titleLarge" style={styles.orderTitle}>
                {labResultsText(LAB_ORDER_TEXT.recent.orderTitle)}
              </Text>
              <Text variant="bodySmall" style={styles.orderDate}>
                {labResultsText(LAB_RESULTS_TEXT.fields.orderDate, {
                  date: new Date(order.created_at).toLocaleDateString(),
                  time: new Date(order.created_at).toLocaleTimeString(),
                })}
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
              {labOrderStatusText(orderStatus)}
            </Chip>

            {order.priority && order.priority !== "routine" && (
              <Chip
                icon="alert"
                style={[
                  styles.priorityChip,
                  { backgroundColor: order.priority === "stat" ? "#ffe3e3" : "#fff3bf" },
                ]}
              >
                {labPriorityText(order.priority)}
              </Chip>
            )}
          </View>

          {order.ordered_by && (
            <Text variant="bodySmall" style={styles.physician}>
              {labResultsText(LAB_RESULTS_TEXT.fields.orderedBy, { user: order.ordered_by })}
            </Text>
          )}
        </Surface>

        {/* View Mode Tabs */}
        <SegmentedButtons
          value={viewMode}
          onValueChange={(v) => setViewMode(v as ViewMode)}
          buttons={[
            { value: "latest", label: labResultsText(LAB_RESULTS_TEXT.tabs.latest) },
            { value: "history", label: labResultsText(LAB_RESULTS_TEXT.tabs.history) },
            { value: "trends", label: labResultsText(LAB_RESULTS_TEXT.tabs.trends) },
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
                    {labResultsText(LAB_RESULTS_TEXT.sections.testResults)}
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
                              {labResultsText(LAB_RESULTS_TEXT.fields.referenceRange, {
                                range: result.normal_range,
                                unit: result.unit || "",
                              })}
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
                            {resultStatusText(status)}
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
                  {labResultsText(LAB_RESULTS_TEXT.empty.pendingTitle)}
                </Text>
                <Text variant="bodySmall" style={styles.emptyHint}>
                  {labResultsText(LAB_RESULTS_TEXT.empty.pendingHint)}
                </Text>
              </Surface>
            )}

            {/* Notes */}
            {order.notes && (
              <Card style={styles.interpretationCard}>
                <Card.Content>
                  <View style={styles.interpretationHeader}>
                    <Avatar.Icon size={32} icon="text" style={styles.interpretationIcon} />
                    <Text variant="titleSmall">
                      {labResultsText(LAB_RESULTS_TEXT.sections.notes)}
                    </Text>
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
                {labResultsText(LAB_RESULTS_TEXT.sections.previousOrders)}
              </Text>
              <Divider style={styles.divider} />

              {patientOrders.orders.map((historyOrder) => (
                <List.Item
                  key={historyOrder.id}
                  title={labResultsText(LAB_ORDER_TEXT.recent.orderTitle)}
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
                      style={historyOrder.status === "completed" ? styles.completedChip : undefined}
                    >
                      {labOrderStatusText(historyOrder.status)}
                    </Chip>
                  )}
                />
              ))}
            </Card.Content>
          </Card>
        )}

        {viewMode === "history" &&
          (!patientOrders?.orders || patientOrders.orders.length === 0) && (
            <Surface style={styles.emptyState} elevation={1}>
              <Avatar.Icon size={48} icon="history" style={styles.emptyIcon} />
              <Text variant="bodyMedium" style={styles.emptyText}>
                {labResultsText(LAB_RESULTS_TEXT.empty.noPreviousOrders)}
              </Text>
            </Surface>
          )}

        {/* Trends View */}
        {viewMode === "trends" && (
          <Surface style={styles.trendsPlaceholder} elevation={1}>
            <Avatar.Icon size={48} icon="chart-line" style={styles.trendsIcon} />
            <Text variant="bodyMedium" style={styles.trendsText}>
              {labResultsText(LAB_RESULTS_TEXT.empty.trendsTitle)}
            </Text>
            <Text variant="bodySmall" style={styles.trendsHint}>
              {labResultsText(LAB_RESULTS_TEXT.empty.trendsHint)}
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
