import { useAuthStore } from "@medbrains/stores";
import type {
  Patient,
  PatientAppointmentRow,
  PatientInvoiceRow,
  PatientLabOrderRow,
  PrescriptionHistoryItem,
} from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import {
  ActivityIndicator,
  Avatar,
  Button,
  Card,
  Chip,
  Surface,
  Text,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { patientService } from "../../services/patient.service";
import { MEDBRAINS_COLORS } from "../../theme/paper-theme";

type DashboardRoute = "Appointments" | "LabResults" | "Prescriptions" | "Billing";

interface PatientDashboardProps {
  navigation: {
    navigate: (screen: DashboardRoute, params?: Record<string, unknown>) => void;
  };
}

interface QuickAction {
  id: string;
  icon: string;
  label: string;
  color: string;
  route: DashboardRoute;
}

interface SummaryItem {
  id: string;
  icon: string;
  label: string;
  value: string;
  hint: string;
  color: string;
  route: DashboardRoute;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: "appointments",
    icon: "calendar-clock",
    label: "Appointments",
    color: MEDBRAINS_COLORS.brand,
    route: "Appointments",
  },
  {
    id: "lab",
    icon: "flask",
    label: "Lab Results",
    color: MEDBRAINS_COLORS.emerald,
    route: "LabResults",
  },
  {
    id: "prescription",
    icon: "pill",
    label: "Prescriptions",
    color: MEDBRAINS_COLORS.statusWarning,
    route: "Prescriptions",
  },
  {
    id: "billing",
    icon: "receipt",
    label: "Bills",
    color: MEDBRAINS_COLORS.copper,
    route: "Billing",
  },
];

function parseDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getLocalDateKey(date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function formatDate(value: string): string {
  const date = parseDate(value);
  return date ? date.toLocaleDateString("en-IN") : "Date pending";
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function buildPatientName(patient: Patient | undefined, fallbackName: string | undefined): string {
  if (patient) {
    const name = [patient.first_name, patient.middle_name, patient.last_name]
      .filter(Boolean)
      .join(" ")
      .trim();

    if (name.length > 0) {
      return name;
    }
  }

  return fallbackName?.trim() || "Patient";
}

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return "PT";
  }

  if (words.length === 1) {
    return words[0]?.slice(0, 2).toUpperCase() || "PT";
  }

  return words
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join("")
    .toUpperCase();
}

function isUpcomingAppointment(appointment: PatientAppointmentRow): boolean {
  const appointmentDateKey = appointment.appointment_date.slice(0, 10);
  const closedStatuses = new Set(["cancelled", "completed", "no_show"]);
  return appointmentDateKey >= getLocalDateKey() && !closedStatuses.has(appointment.status);
}

function getAppointmentTime(appointment: PatientAppointmentRow): string {
  if (appointment.slot_start && appointment.slot_end) {
    return `${appointment.slot_start.slice(0, 5)} - ${appointment.slot_end.slice(0, 5)}`;
  }

  const appointmentDate = parseDate(appointment.appointment_date);
  return appointmentDate
    ? appointmentDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "Time pending";
}

function isPendingInvoice(invoice: PatientInvoiceRow): boolean {
  return ["draft", "issued", "partially_paid"].includes(invoice.status);
}

function sumInvoiceBalance(invoices: PatientInvoiceRow[]): number {
  return invoices.reduce((sum, invoice) => sum + Number.parseFloat(invoice.balance || "0"), 0);
}

function countRecentMedicationItems(prescriptions: PrescriptionHistoryItem[]): number {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  return prescriptions
    .filter((prescription) => {
      const encounterDate = parseDate(prescription.encounter_date);
      return encounterDate ? encounterDate >= thirtyDaysAgo : false;
    })
    .reduce((sum, prescription) => sum + prescription.items.length, 0);
}

function isLabResultReady(order: PatientLabOrderRow): boolean {
  return order.status === "completed" || order.status === "verified";
}

function buildSummaryItems(params: {
  upcomingAppointments: PatientAppointmentRow[];
  pendingInvoices: PatientInvoiceRow[];
  outstandingBalance: number;
  recentMedicationCount: number;
  labOrders: PatientLabOrderRow[];
}): SummaryItem[] {
  const readyLabOrders = params.labOrders.filter(isLabResultReady);
  const nextAppointment = params.upcomingAppointments[0];

  return [
    {
      id: "appointments",
      icon: "calendar-check",
      label: "Upcoming",
      value: String(params.upcomingAppointments.length),
      hint: nextAppointment
        ? `${nextAppointment.doctor_name || "Doctor"} on ${formatDate(nextAppointment.appointment_date)}`
        : "No appointments scheduled",
      color: MEDBRAINS_COLORS.brand,
      route: "Appointments",
    },
    {
      id: "billing",
      icon: "receipt-text",
      label: "Outstanding",
      value: formatCurrency(params.outstandingBalance),
      hint:
        params.pendingInvoices.length > 0
          ? `${params.pendingInvoices.length} pending bill${
              params.pendingInvoices.length > 1 ? "s" : ""
            }`
          : "No pending bills",
      color: MEDBRAINS_COLORS.copper,
      route: "Billing",
    },
    {
      id: "prescriptions",
      icon: "pill",
      label: "Recent Meds",
      value: String(params.recentMedicationCount),
      hint: "Medication items in the last 30 days",
      color: MEDBRAINS_COLORS.statusWarning,
      route: "Prescriptions",
    },
    {
      id: "labs",
      icon: "flask-check",
      label: "Ready Labs",
      value: String(readyLabOrders.length),
      hint: `${params.labOrders.length} lab order${params.labOrders.length === 1 ? "" : "s"} total`,
      color: MEDBRAINS_COLORS.emerald,
      route: "LabResults",
    },
  ];
}

function QuickActionButton({
  action,
  onPress,
}: {
  action: QuickAction;
  onPress: (route: DashboardRoute) => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.actionButton, { backgroundColor: action.color }]}
      onPress={() => onPress(action.route)}
    >
      <Avatar.Icon size={40} icon={action.icon} style={styles.actionIcon} />
      <Text style={styles.actionLabel}>{action.label}</Text>
    </TouchableOpacity>
  );
}

function AppointmentCard({ appointment }: { appointment: PatientAppointmentRow }) {
  const appointmentDate = parseDate(appointment.appointment_date);

  return (
    <Card style={styles.appointmentCard}>
      <Card.Content style={styles.appointmentContent}>
        <View style={styles.dateBox}>
          <Text style={styles.dateDay}>{appointmentDate ? appointmentDate.getDate() : "--"}</Text>
          <Text style={styles.dateMonth}>
            {appointmentDate ? appointmentDate.toLocaleString("en", { month: "short" }) : "TBD"}
          </Text>
        </View>
        <View style={styles.appointmentRight}>
          <Text variant="titleMedium" style={styles.appointmentDoctor}>
            {appointment.doctor_name || "Doctor"}
          </Text>
          <Text variant="bodySmall" style={styles.department}>
            {appointment.department_name || "General"}
          </Text>
          <View style={styles.appointmentMeta}>
            <Chip compact icon="clock-outline" style={styles.timeChip}>
              {getAppointmentTime(appointment)}
            </Chip>
            <Chip compact mode="flat" style={styles.statusChip}>
              {appointment.status || "pending"}
            </Chip>
          </View>
        </View>
      </Card.Content>
    </Card>
  );
}

function SummaryTile({
  item,
  onPress,
}: {
  item: SummaryItem;
  onPress: (route: DashboardRoute) => void;
}) {
  return (
    <TouchableOpacity style={styles.summaryTile} onPress={() => onPress(item.route)}>
      <View style={styles.summaryHeader}>
        <Avatar.Icon
          size={34}
          icon={item.icon}
          style={[styles.summaryIcon, { backgroundColor: `${item.color}20` }]}
          color={item.color}
        />
        <Text variant="labelMedium" style={styles.summaryLabel}>
          {item.label}
        </Text>
      </View>
      <Text variant="titleLarge" style={styles.summaryValue}>
        {item.value}
      </Text>
      <Text variant="bodySmall" style={styles.summaryHint} numberOfLines={2}>
        {item.hint}
      </Text>
    </TouchableOpacity>
  );
}

export function PatientDashboard({ navigation }: PatientDashboardProps) {
  const theme = useTheme();
  const { user } = useAuthStore();
  const patientId = user?.id || "";

  const { data: patient, isLoading: isPatientLoading } = useQuery({
    queryKey: ["patient", patientId],
    queryFn: () => patientService.getPatient(patientId),
    enabled: Boolean(patientId),
  });

  const { data: appointmentData, isLoading: isAppointmentsLoading } = useQuery({
    queryKey: ["patient", "appointments", patientId],
    queryFn: () => patientService.listPatientAppointments(patientId),
    enabled: Boolean(patientId),
  });

  const { data: invoiceData, isLoading: isInvoicesLoading } = useQuery({
    queryKey: ["patient", "invoices", patientId],
    queryFn: () => patientService.listPatientInvoices(patientId),
    enabled: Boolean(patientId),
  });

  const { data: prescriptionData, isLoading: isPrescriptionsLoading } = useQuery({
    queryKey: ["patient", "prescriptions", patientId],
    queryFn: () => patientService.listPatientPrescriptions(patientId),
    enabled: Boolean(patientId),
  });

  const { data: labOrderData, isLoading: isLabOrdersLoading } = useQuery({
    queryKey: ["patient", "labOrders", patientId],
    queryFn: () => patientService.listPatientLabOrders(patientId),
    enabled: Boolean(patientId),
  });

  const handleNavigate = (route: DashboardRoute) => {
    navigation.navigate(route);
  };

  if (!patientId) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.unavailableContainer}>
          <Avatar.Icon size={56} icon="account-alert" />
          <Text variant="titleMedium" style={styles.emptyTitle}>
            Patient context unavailable
          </Text>
          <Text variant="bodyMedium" style={styles.emptyText}>
            Sign in with a linked patient account to view dashboard details.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const appointments = appointmentData || [];
  const invoices = invoiceData || [];
  const prescriptions = prescriptionData || [];
  const labOrders = labOrderData || [];
  const pendingInvoices = invoices.filter(isPendingInvoice);
  const outstandingBalance = sumInvoiceBalance(pendingInvoices);
  const upcomingAppointments = appointments
    .filter(isUpcomingAppointment)
    .sort(
      (left, right) =>
        (parseDate(left.appointment_date)?.getTime() || 0) -
        (parseDate(right.appointment_date)?.getTime() || 0),
    )
    .slice(0, 2);
  const recentMedicationCount = countRecentMedicationItems(prescriptions);
  const summaryItems = buildSummaryItems({
    upcomingAppointments,
    pendingInvoices,
    outstandingBalance,
    recentMedicationCount,
    labOrders,
  });
  const patientName = buildPatientName(patient, user?.full_name);
  const patientIdentifier = patient?.uhid || user?.username || patientId;
  const isSummaryLoading =
    isInvoicesLoading || isPrescriptionsLoading || isLabOrdersLoading || isAppointmentsLoading;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Surface style={styles.header} elevation={2}>
          <View style={styles.headerContent}>
            <Avatar.Text size={56} label={getInitials(patientName)} />
            <View style={styles.headerText}>
              <Text variant="headlineSmall" style={styles.welcomeText}>
                Welcome back,
              </Text>
              {isPatientLoading ? (
                <ActivityIndicator size="small" style={styles.headerLoader} />
              ) : (
                <>
                  <Text variant="titleLarge" style={styles.patientName}>
                    {patientName}
                  </Text>
                  <Text variant="bodySmall" style={styles.uhid}>
                    {patientIdentifier}
                  </Text>
                </>
              )}
            </View>
          </View>
        </Surface>

        <Text variant="titleMedium" style={styles.sectionTitle}>
          Quick Actions
        </Text>
        <View style={styles.actionsGrid}>
          {QUICK_ACTIONS.map((action) => (
            <QuickActionButton key={action.id} action={action} onPress={handleNavigate} />
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <Text variant="titleMedium" style={styles.sectionHeaderTitle}>
            Upcoming Appointments
          </Text>
          <TouchableOpacity onPress={() => navigation.navigate("Appointments")}>
            <Text variant="labelMedium" style={{ color: theme.colors.primary }}>
              See All
            </Text>
          </TouchableOpacity>
        </View>

        {isAppointmentsLoading ? (
          <Surface style={styles.loadingCard} elevation={1}>
            <ActivityIndicator />
            <Text variant="bodyMedium" style={styles.loadingText}>
              Loading appointments...
            </Text>
          </Surface>
        ) : upcomingAppointments.length > 0 ? (
          <View style={styles.appointmentsList}>
            {upcomingAppointments.map((appointment) => (
              <AppointmentCard key={appointment.id} appointment={appointment} />
            ))}
          </View>
        ) : (
          <Surface style={styles.emptyState} elevation={1}>
            <Avatar.Icon size={48} icon="calendar-blank" />
            <Text variant="bodyMedium" style={styles.emptyText}>
              No upcoming appointments
            </Text>
            <Button
              mode="text"
              icon="calendar-clock"
              onPress={() => navigation.navigate("Appointments")}
            >
              View appointments
            </Button>
          </Surface>
        )}

        <View style={styles.sectionHeader}>
          <Text variant="titleMedium" style={styles.sectionHeaderTitle}>
            Care Summary
          </Text>
          {isSummaryLoading && <ActivityIndicator size="small" />}
        </View>
        <Surface style={styles.summaryCard} elevation={1}>
          <View style={styles.summaryGrid}>
            {summaryItems.map((item) => (
              <SummaryTile key={item.id} item={item} onPress={handleNavigate} />
            ))}
          </View>
        </Surface>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  unavailableContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 12,
  },
  header: {
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  headerText: {
    flex: 1,
  },
  headerLoader: {
    alignSelf: "flex-start",
    marginTop: 8,
  },
  welcomeText: {
    opacity: 0.6,
  },
  patientName: {
    fontWeight: "bold",
  },
  uhid: {
    opacity: 0.5,
    marginTop: 2,
  },
  sectionTitle: {
    marginBottom: 12,
    fontWeight: "600",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    marginTop: 24,
  },
  sectionHeaderTitle: {
    fontWeight: "600",
  },
  actionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  actionButton: {
    width: "48%",
    aspectRatio: 1.5,
    borderRadius: 12,
    padding: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  actionIcon: {
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  actionLabel: {
    color: "#ffffff",
    fontWeight: "600",
    marginTop: 8,
    fontSize: 14,
    textAlign: "center",
  },
  appointmentsList: {
    gap: 12,
  },
  appointmentCard: {
    borderRadius: 12,
  },
  appointmentContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  dateBox: {
    backgroundColor: MEDBRAINS_COLORS.statusInfoBg,
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
    minWidth: 56,
  },
  dateDay: {
    fontSize: 24,
    fontWeight: "bold",
    color: MEDBRAINS_COLORS.brand,
  },
  dateMonth: {
    fontSize: 12,
    color: MEDBRAINS_COLORS.brand,
    textTransform: "uppercase",
  },
  appointmentRight: {
    flex: 1,
  },
  appointmentDoctor: {
    fontWeight: "600",
  },
  department: {
    opacity: 0.6,
    marginTop: 2,
  },
  appointmentMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  timeChip: {
    height: 28,
  },
  statusChip: {
    height: 28,
    backgroundColor: MEDBRAINS_COLORS.navActiveBg,
  },
  emptyState: {
    borderRadius: 12,
    padding: 32,
    alignItems: "center",
    gap: 8,
  },
  emptyTitle: {
    fontWeight: "600",
    textAlign: "center",
  },
  emptyText: {
    opacity: 0.6,
    textAlign: "center",
  },
  loadingCard: {
    borderRadius: 12,
    padding: 24,
    alignItems: "center",
    gap: 10,
  },
  loadingText: {
    opacity: 0.6,
  },
  summaryCard: {
    borderRadius: 12,
    padding: 12,
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  summaryTile: {
    width: "48%",
    minHeight: 128,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: MEDBRAINS_COLORS.rule,
    padding: 12,
    backgroundColor: MEDBRAINS_COLORS.canvas,
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  summaryIcon: {
    marginBottom: 0,
  },
  summaryLabel: {
    flex: 1,
    color: MEDBRAINS_COLORS.muted,
  },
  summaryValue: {
    marginTop: 12,
    fontWeight: "700",
    color: MEDBRAINS_COLORS.ink,
  },
  summaryHint: {
    marginTop: 6,
    color: MEDBRAINS_COLORS.muted,
  },
});
