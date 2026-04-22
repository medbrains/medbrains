import { api } from "@medbrains/api";
import { useAuthStore } from "@medbrains/stores";
import { useQuery } from "@tanstack/react-query";
import React, { useState } from "react";
import { FlatList, StyleSheet, TouchableOpacity, View } from "react-native";
import {
  ActivityIndicator,
  Avatar,
  Button,
  Card,
  Chip,
  SegmentedButtons,
  Surface,
  Text,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

type FilterType = "pending" | "paid" | "all";

interface BillingScreenProps {
  navigation: {
    navigate: (screen: string, params?: Record<string, unknown>) => void;
  };
}

function getStatusColor(status: string): string {
  switch (status) {
    case "paid":
      return "#40c057";
    case "partial":
      return "#fab005";
    case "pending":
    case "unpaid":
      return "#fa5252";
    case "cancelled":
      return "#868e96";
    default:
      return "#868e96";
  }
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function BillingScreen({ navigation }: BillingScreenProps) {
  const theme = useTheme();
  const { user } = useAuthStore();

  const [filter, setFilter] = useState<FilterType>("pending");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["patient", "invoices", user?.id, filter],
    queryFn: () => api.listPatientInvoices(user?.id || ""),
    enabled: Boolean(user?.id),
  });

  // Filter invoices based on selected filter
  const allInvoices = data || [];
  const invoices = filter === "all"
    ? allInvoices
    : allInvoices.filter((inv) => {
        if (filter === "pending") return inv.status === "draft" || inv.status === "issued" || inv.status === "partially_paid";
        if (filter === "paid") return inv.status === "paid";
        return true;
      });

  const totalPending = allInvoices
    .filter((inv) => inv.status === "draft" || inv.status === "issued" || inv.status === "partially_paid")
    .reduce((sum, inv) => sum + Number.parseFloat(inv.balance || "0"), 0);

  const renderInvoiceCard = ({ item }: { item: (typeof invoices)[0] }) => {
    const invoiceDate = new Date(item.issued_at || item.created_at);
    const statusColor = getStatusColor(item.status);
    const isPending = item.status === "draft" || item.status === "issued" || item.status === "partially_paid";
    const totalAmount = Number.parseFloat(item.total_amount || "0");
    const paidAmount = Number.parseFloat(item.paid_amount || "0");
    const balance = Number.parseFloat(item.balance || "0");

    return (
      <TouchableOpacity
        onPress={() => navigation.navigate("BillDetail", { invoiceId: item.id })}
      >
        <Card style={styles.invoiceCard}>
          <Card.Content>
            <View style={styles.cardHeader}>
              <View style={styles.invoiceInfo}>
                <Text variant="titleMedium" style={styles.invoiceNumber}>
                  {item.invoice_number || `INV-${item.id.slice(0, 8)}`}
                </Text>
                <Text variant="bodySmall" style={styles.invoiceDate}>
                  {invoiceDate.toLocaleDateString()}
                </Text>
              </View>
              <View style={styles.amountInfo}>
                <Text variant="titleLarge" style={[styles.amount, isPending && styles.amountDue]}>
                  {formatCurrency(isPending ? balance : totalAmount)}
                </Text>
                <Chip
                  compact
                  style={{ backgroundColor: `${statusColor}20` }}
                  textStyle={{ color: statusColor }}
                >
                  {item.status}
                </Chip>
              </View>
            </View>

            {/* Item Count */}
            {item.item_count != null && item.item_count > 0 && (
              <View style={styles.servicesRow}>
                <Avatar.Icon size={24} icon="clipboard-list" style={styles.servicesIcon} />
                <Text variant="bodySmall" style={styles.servicesText}>
                  {item.item_count} item{item.item_count > 1 ? "s" : ""}
                </Text>
              </View>
            )}

            {/* Payment Info */}
            <View style={styles.paymentRow}>
              <View style={styles.paymentItem}>
                <Text variant="labelSmall" style={styles.paymentLabel}>
                  Total
                </Text>
                <Text variant="bodyMedium" style={styles.paymentValue}>
                  {formatCurrency(totalAmount)}
                </Text>
              </View>
              <View style={styles.paymentItem}>
                <Text variant="labelSmall" style={styles.paymentLabel}>
                  Paid
                </Text>
                <Text variant="bodyMedium" style={[styles.paymentValue, { color: "#40c057" }]}>
                  {formatCurrency(paidAmount)}
                </Text>
              </View>
              <View style={styles.paymentItem}>
                <Text variant="labelSmall" style={styles.paymentLabel}>
                  Due
                </Text>
                <Text
                  variant="bodyMedium"
                  style={[styles.paymentValue, { color: isPending ? "#fa5252" : "#868e96" }]}
                >
                  {formatCurrency(balance)}
                </Text>
              </View>
            </View>

            {/* Pay Now Button */}
            {isPending && balance > 0 && (
              <Button
                mode="contained"
                icon="credit-card"
                onPress={() => navigation.navigate("Payment", { invoiceId: item.id })}
                style={styles.payButton}
              >
                Pay Now
              </Button>
            )}
          </Card.Content>
        </Card>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Outstanding Amount Banner */}
      {totalPending > 0 && (
        <Surface style={styles.outstandingBanner} elevation={2}>
          <View style={styles.outstandingInfo}>
            <Text variant="labelMedium">Total Outstanding</Text>
            <Text variant="headlineMedium" style={styles.outstandingAmount}>
              {formatCurrency(totalPending)}
            </Text>
          </View>
          <Button mode="contained" compact icon="credit-card">
            Pay All
          </Button>
        </Surface>
      )}

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <SegmentedButtons
          value={filter}
          onValueChange={(v) => setFilter(v as FilterType)}
          buttons={[
            { value: "pending", label: "Pending" },
            { value: "paid", label: "Paid" },
            { value: "all", label: "All" },
          ]}
        />
      </View>

      {/* Invoices List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <Text variant="bodyMedium" style={styles.loadingText}>
            Loading bills...
          </Text>
        </View>
      ) : invoices.length > 0 ? (
        <FlatList
          data={invoices}
          keyExtractor={(item) => item.id}
          renderItem={renderInvoiceCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onRefresh={refetch}
          refreshing={isLoading}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Avatar.Icon size={64} icon="receipt" style={styles.emptyIcon} />
          <Text variant="titleMedium" style={styles.emptyTitle}>
            No bills
          </Text>
          <Text variant="bodyMedium" style={styles.emptyText}>
            {filter === "pending"
              ? "You have no pending bills"
              : filter === "paid"
                ? "No paid bills found"
                : "No billing history"}
          </Text>
        </View>
      )}

      {/* Payment Methods Info */}
      <Surface style={styles.paymentMethodsBanner} elevation={1}>
        <Text variant="labelMedium" style={styles.methodsTitle}>
          Accepted Payment Methods
        </Text>
        <View style={styles.methodsRow}>
          <Chip compact icon="cellphone">UPI</Chip>
          <Chip compact icon="credit-card">Card</Chip>
          <Chip compact icon="bank">Net Banking</Chip>
          <Chip compact icon="cash">Cash</Chip>
        </View>
      </Surface>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  outstandingBanner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    margin: 16,
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#fff5f5",
  },
  outstandingInfo: {
    flex: 1,
  },
  outstandingAmount: {
    fontWeight: "bold",
    color: "#fa5252",
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
  invoiceCard: {
    marginBottom: 12,
    borderRadius: 12,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  invoiceInfo: {},
  invoiceNumber: {
    fontWeight: "600",
  },
  invoiceDate: {
    opacity: 0.6,
    marginTop: 2,
  },
  amountInfo: {
    alignItems: "flex-end",
  },
  amount: {
    fontWeight: "bold",
    marginBottom: 4,
  },
  amountDue: {
    color: "#fa5252",
  },
  servicesRow: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#f8f9fa",
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  servicesIcon: {
    backgroundColor: "#e7f5ff",
    width: 24,
    height: 24,
  },
  servicesText: {
    flex: 1,
    opacity: 0.7,
  },
  paymentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  paymentItem: {
    alignItems: "center",
  },
  paymentLabel: {
    opacity: 0.6,
  },
  paymentValue: {
    fontWeight: "600",
  },
  payButton: {
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
  paymentMethodsBanner: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  methodsTitle: {
    opacity: 0.6,
    marginBottom: 8,
  },
  methodsRow: {
    flexDirection: "row",
    gap: 8,
  },
});
