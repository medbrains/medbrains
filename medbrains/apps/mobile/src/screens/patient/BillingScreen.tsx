import { useAuthStore } from "@medbrains/stores";
import type { Invoice, InvoiceStatus, PatientInvoiceRow } from "@medbrains/types";
import {
  billingInvoiceBalance,
  billingInvoiceDisplayStatus,
  billingInvoiceRequiresFollowUp,
} from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
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
import { patientService } from "../../services/patient.service";
import { mobileBillingStatusText, mobileBillingText } from "./billingText";

type FilterType = "pending" | "paid" | "all";
type BillingHandoff = "discharge_bill" | "payment";

interface MobileBillingInvoice {
  id: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  itemCount: number | null;
  issuedAt: string | null;
  createdAt: string;
  admissionId: string | null;
  encounterId: string | null;
}

interface BillingScreenProps {
  route?: {
    params?: {
      admissionId?: string;
      encounterId?: string;
      filter?: FilterType;
      handoff?: BillingHandoff;
      patientId?: string;
    };
  };
  navigation: {
    navigate: (screen: string, params?: Record<string, unknown>) => void;
  };
}

const FILTER_TYPES: FilterType[] = ["pending", "paid", "all"];

function isFilterType(value: string): value is FilterType {
  return FILTER_TYPES.some((filterType) => filterType === value);
}

function parseAmount(value: string | null | undefined): number {
  if (!value) return 0;
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function invoiceBalance(invoice: Invoice): number {
  return billingInvoiceBalance(invoice.total_amount, invoice.paid_amount);
}

function patientInvoiceToMobileInvoice(row: PatientInvoiceRow): MobileBillingInvoice {
  return {
    id: row.id,
    invoiceNumber: row.invoice_number,
    status: billingInvoiceDisplayStatus(row.status, row.total_amount, row.paid_amount),
    totalAmount: parseAmount(row.total_amount),
    paidAmount: parseAmount(row.paid_amount),
    balanceAmount: billingInvoiceBalance(row.total_amount, row.paid_amount),
    itemCount: row.item_count,
    issuedAt: row.issued_at,
    createdAt: row.created_at,
    admissionId: null,
    encounterId: null,
  };
}

function billingInvoiceToMobileInvoice(row: Invoice): MobileBillingInvoice {
  return {
    id: row.id,
    invoiceNumber: row.invoice_number,
    status: billingInvoiceDisplayStatus(row.status, row.total_amount, row.paid_amount),
    totalAmount: parseAmount(row.total_amount),
    paidAmount: parseAmount(row.paid_amount),
    balanceAmount: invoiceBalance(row),
    itemCount: null,
    issuedAt: row.issued_at,
    createdAt: row.created_at,
    admissionId: row.admission_id,
    encounterId: row.encounter_id,
  };
}

function billingInvoiceParams(params: {
  admissionId?: string;
  encounterId?: string;
  patientId?: string;
}): Record<string, string> {
  const queryParams: Record<string, string> = { page: "1", per_page: "100" };
  if (params.patientId) queryParams.patient_id = params.patientId;
  if (params.admissionId) {
    queryParams.admission_id = params.admissionId;
  } else if (params.encounterId) {
    queryParams.encounter_id = params.encounterId;
  }
  return queryParams;
}

function handoffTitle(handoff: BillingHandoff | undefined): string {
  switch (handoff) {
    case "payment":
      return mobileBillingText("billing.handoff.payment.title");
    case "discharge_bill":
      return mobileBillingText("billing.handoff.dischargeBill.title");
    default:
      return mobileBillingText("billing.handoff.default.title");
  }
}

function handoffHint(params: {
  admissionId?: string;
  encounterId?: string;
  handoff?: BillingHandoff;
}): string {
  if (params.handoff === "discharge_bill" && params.admissionId) {
    return mobileBillingText("billing.handoff.dischargeBill.hint");
  }
  if (params.admissionId) {
    return mobileBillingText("billing.handoff.ipd.hint");
  }
  if (params.encounterId) {
    return mobileBillingText("billing.handoff.opd.hint");
  }
  return mobileBillingText("billing.handoff.default.hint");
}

function emptyBillingText(filter: FilterType, handoff: BillingHandoff | undefined): string {
  if (handoff === "discharge_bill" && filter === "pending") {
    return mobileBillingText("billing.empty.pendingDischargeBills");
  }
  if (filter === "pending") return mobileBillingText("billing.empty.pending");
  if (filter === "paid") return mobileBillingText("billing.empty.paid");
  return mobileBillingText("billing.empty.history");
}

function getStatusColor(status: string): string {
  switch (status) {
    case "paid":
      return "#10b981";
    case "partial":
    case "partially_paid":
      return "#fab005";
    case "pending":
    case "unpaid":
      return "#C8102E";
    case "cancelled":
      return "#868e96";
    default:
      return "#868e96";
  }
}

function isPendingInvoice(
  invoice: Pick<MobileBillingInvoice, "paidAmount" | "status" | "totalAmount">,
) {
  return billingInvoiceRequiresFollowUp(invoice.status, invoice.totalAmount, invoice.paidAmount);
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function BillingScreen({ navigation, route }: BillingScreenProps) {
  const theme = useTheme();
  const { user } = useAuthStore();
  const routePatientId = route?.params?.patientId;
  const routeAdmissionId = route?.params?.admissionId;
  const routeEncounterId = route?.params?.encounterId;
  const routeHandoff = route?.params?.handoff;
  const patientId = routePatientId ?? user?.id ?? "";
  const isStaffPatientContext = Boolean(routePatientId || routeAdmissionId || routeEncounterId);
  const initialFilter = route?.params?.filter ?? "pending";

  const [filter, setFilter] = useState<FilterType>(initialFilter);

  const { data, isLoading, refetch } = useQuery({
    queryKey: [
      "patient",
      "invoices",
      patientId,
      routeAdmissionId ?? null,
      routeEncounterId ?? null,
      filter,
    ],
    queryFn: async () => {
      if (isStaffPatientContext) {
        const response = await patientService.listBillingInvoices(
          billingInvoiceParams({
            admissionId: routeAdmissionId,
            encounterId: routeEncounterId,
            patientId,
          }),
        );
        return response.invoices.map(billingInvoiceToMobileInvoice);
      }
      const patientInvoices = await patientService.listPatientInvoices(patientId);
      return patientInvoices.map(patientInvoiceToMobileInvoice);
    },
    enabled: Boolean(patientId),
  });

  // Filter invoices based on selected filter
  const allInvoices = data || [];
  const invoices =
    filter === "all"
      ? allInvoices
      : allInvoices.filter((inv) => {
          if (filter === "pending") return isPendingInvoice(inv);
          if (filter === "paid") return inv.status === "paid";
          return true;
        });

  const totalPending = allInvoices
    .filter(isPendingInvoice)
    .reduce((sum, inv) => sum + inv.balanceAmount, 0);

  const renderInvoiceCard = ({ item }: { item: MobileBillingInvoice }) => {
    const invoiceDate = new Date(item.issuedAt || item.createdAt);
    const invoiceDateLabel = Number.isNaN(invoiceDate.getTime())
      ? mobileBillingText("billing.date.notDated")
      : invoiceDate.toLocaleDateString();
    const statusColor = getStatusColor(item.status);
    const isPending = isPendingInvoice(item);

    return (
      <TouchableOpacity onPress={() => navigation.navigate("BillDetail", { invoiceId: item.id })}>
        <Card style={styles.invoiceCard}>
          <Card.Content>
            <View style={styles.cardHeader}>
              <View style={styles.invoiceInfo}>
                <Text variant="titleMedium" style={styles.invoiceNumber}>
                  {item.invoiceNumber ||
                    mobileBillingText("billing.invoice.fallbackNumber", {
                      id: item.id.slice(0, 8),
                    })}
                </Text>
                <Text variant="bodySmall" style={styles.invoiceDate}>
                  {invoiceDateLabel}
                </Text>
              </View>
              <View style={styles.amountInfo}>
                <Text variant="titleLarge" style={[styles.amount, isPending && styles.amountDue]}>
                  {formatCurrency(isPending ? item.balanceAmount : item.totalAmount)}
                </Text>
                <Chip
                  compact
                  style={{ backgroundColor: `${statusColor}20` }}
                  textStyle={{ color: statusColor }}
                >
                  {mobileBillingStatusText(item.status)}
                </Chip>
              </View>
            </View>

            {/* Item Count */}
            {item.itemCount != null && item.itemCount > 0 && (
              <View style={styles.servicesRow}>
                <Avatar.Icon size={24} icon="clipboard-list" style={styles.servicesIcon} />
                <Text variant="bodySmall" style={styles.servicesText}>
                  {mobileBillingText(
                    item.itemCount === 1 ? "billing.itemCount.one" : "billing.itemCount.many",
                    { count: item.itemCount },
                  )}
                </Text>
              </View>
            )}
            {(item.admissionId || item.encounterId) && (
              <View style={styles.contextChips}>
                {item.admissionId && (
                  <Chip compact icon="bed" mode="outlined">
                    {mobileBillingText("billing.context.admissionLinked")}
                  </Chip>
                )}
                {!item.admissionId && item.encounterId && (
                  <Chip compact icon="stethoscope" mode="outlined">
                    {mobileBillingText("billing.context.encounterLinked")}
                  </Chip>
                )}
              </View>
            )}

            {/* Payment Info */}
            <View style={styles.paymentRow}>
              <View style={styles.paymentItem}>
                <Text variant="labelSmall" style={styles.paymentLabel}>
                  {mobileBillingText("billing.label.total")}
                </Text>
                <Text variant="bodyMedium" style={styles.paymentValue}>
                  {formatCurrency(item.totalAmount)}
                </Text>
              </View>
              <View style={styles.paymentItem}>
                <Text variant="labelSmall" style={styles.paymentLabel}>
                  {mobileBillingText("billing.label.paid")}
                </Text>
                <Text variant="bodyMedium" style={[styles.paymentValue, { color: "#10b981" }]}>
                  {formatCurrency(item.paidAmount)}
                </Text>
              </View>
              <View style={styles.paymentItem}>
                <Text variant="labelSmall" style={styles.paymentLabel}>
                  {mobileBillingText("billing.label.due")}
                </Text>
                <Text
                  variant="bodyMedium"
                  style={[styles.paymentValue, { color: isPending ? "#C8102E" : "#868e96" }]}
                >
                  {formatCurrency(item.balanceAmount)}
                </Text>
              </View>
            </View>

            {/* Pay Now Button */}
            {isPending && item.balanceAmount > 0 && (
              <Button
                mode="contained"
                icon="credit-card"
                onPress={() => navigation.navigate("Payment", { invoiceId: item.id })}
                style={styles.payButton}
              >
                {mobileBillingText("billing.button.payNow")}
              </Button>
            )}
          </Card.Content>
        </Card>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {isStaffPatientContext && (
        <Surface style={styles.handoffBanner} elevation={1}>
          <Avatar.Icon size={36} icon="account-cash" style={styles.handoffIcon} />
          <View style={styles.handoffText}>
            <Text variant="labelMedium">{handoffTitle(routeHandoff)}</Text>
            <Text variant="bodySmall" style={styles.handoffHint}>
              {handoffHint({
                admissionId: routeAdmissionId,
                encounterId: routeEncounterId,
                handoff: routeHandoff,
              })}
            </Text>
          </View>
        </Surface>
      )}

      {/* Outstanding Amount Banner */}
      {totalPending > 0 && (
        <Surface style={styles.outstandingBanner} elevation={2}>
          <View style={styles.outstandingInfo}>
            <Text variant="labelMedium">{mobileBillingText("billing.label.totalOutstanding")}</Text>
            <Text variant="headlineMedium" style={styles.outstandingAmount}>
              {formatCurrency(totalPending)}
            </Text>
          </View>
          <Button mode="contained" compact icon="credit-card">
            {mobileBillingText("billing.button.payAll")}
          </Button>
        </Surface>
      )}

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <SegmentedButtons
          value={filter}
          onValueChange={(value) => {
            if (isFilterType(value)) setFilter(value);
          }}
          buttons={[
            { value: "pending", label: mobileBillingText("billing.filter.pending") },
            { value: "paid", label: mobileBillingText("billing.filter.paid") },
            { value: "all", label: mobileBillingText("billing.filter.all") },
          ]}
        />
      </View>

      {/* Invoices List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <Text variant="bodyMedium" style={styles.loadingText}>
            {mobileBillingText("billing.loading.bills")}
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
            {mobileBillingText("billing.empty.noBills")}
          </Text>
          <Text variant="bodyMedium" style={styles.emptyText}>
            {emptyBillingText(filter, routeHandoff)}
          </Text>
        </View>
      )}

      {/* Payment Methods Info */}
      <Surface style={styles.paymentMethodsBanner} elevation={1}>
        <Text variant="labelMedium" style={styles.methodsTitle}>
          {mobileBillingText("billing.label.acceptedPaymentMethods")}
        </Text>
        <View style={styles.methodsRow}>
          <Chip compact icon="cellphone">
            {mobileBillingText("billing.paymentMethod.upi")}
          </Chip>
          <Chip compact icon="credit-card">
            {mobileBillingText("billing.paymentMethod.card")}
          </Chip>
          <Chip compact icon="bank">
            {mobileBillingText("billing.paymentMethod.netBanking")}
          </Chip>
          <Chip compact icon="cash">
            {mobileBillingText("billing.paymentMethod.cash")}
          </Chip>
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
    color: "#C8102E",
  },
  handoffBanner: {
    margin: 16,
    marginBottom: 8,
    padding: 14,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  handoffIcon: {
    backgroundColor: "#fff3bf",
  },
  handoffText: {
    flex: 1,
  },
  handoffHint: {
    opacity: 0.65,
    marginTop: 2,
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
    color: "#C8102E",
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
  contextChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
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
