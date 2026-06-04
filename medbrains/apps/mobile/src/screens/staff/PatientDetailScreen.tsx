import { useFieldAccess } from "@medbrains/stores";
import type { ClinicalJourneyContext, FieldAccessLevel, PatientVisitRow } from "@medbrains/types";
import { fieldAccessText, mostRestrictedFieldAccess } from "@medbrains/utils";
import { useQuery } from "@tanstack/react-query";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Avatar,
  Button,
  Card,
  Chip,
  Divider,
  List,
  Surface,
  Text,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { PatientJourneyActions } from "../../components";
import { patientService } from "../../services/patient.service";

interface PatientDetailScreenProps {
  route: {
    params: {
      patientId: string;
    };
  };
  navigation: {
    navigate: (screen: string, params?: Record<string, unknown>) => void;
  };
}

const ACTIVE_VISIT_STATUSES = new Set<PatientVisitRow["status"]>(["open", "in_progress"]);
const HIDDEN_FIELD_TEXT = "Restricted";

function calculateAge(dob: string): string {
  const birthDate = new Date(dob);
  if (Number.isNaN(birthDate.getTime())) return "Unknown";
  const today = new Date();
  let years = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    years--;
  }
  return `${years} years`;
}

function protectedField(
  access: FieldAccessLevel,
  value: string | null | undefined,
  kind: "email" | "identifier" | "name" | "phone" | "text" = "text",
  fallback = "Not specified",
): string {
  const display = fieldAccessText(access, value, kind);
  if (display === HIDDEN_FIELD_TEXT) return display;
  return display === "—" ? fallback : display;
}

function protectedDateOfBirth(access: FieldAccessLevel, value: string | null | undefined): string {
  if (access === "hidden") return HIDDEN_FIELD_TEXT;
  if (!value) return "Not specified";
  if (access === "mask") return "Date masked";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleDateString();
}

function protectedAge(access: FieldAccessLevel, value: string | null | undefined): string {
  if (access === "hidden") return HIDDEN_FIELD_TEXT;
  if (!value) return "Unknown";
  if (access === "mask") return "Age masked";
  return calculateAge(value);
}

function isAddressRecord(
  value: unknown,
): value is { city?: unknown; line1?: unknown; pincode?: unknown; state?: unknown } {
  return Boolean(value) && typeof value === "object";
}

function formatAddress(addr: unknown): string {
  if (!isAddressRecord(addr)) return "Not specified";
  const parts = [addr.line1, addr.city, addr.state, addr.pincode].filter(
    (part): part is string => typeof part === "string" && part.trim().length > 0,
  );
  return parts.length > 0 ? parts.join(", ") : "Not specified";
}

export function PatientDetailScreen({ route, navigation }: PatientDetailScreenProps) {
  const theme = useTheme();
  const { patientId } = route.params;
  const uhidAccess = useFieldAccess("patients.uhid");
  const firstNameAccess = useFieldAccess("patients.first_name");
  const middleNameAccess = useFieldAccess("patients.middle_name");
  const lastNameAccess = useFieldAccess("patients.last_name");
  const dobAccess = useFieldAccess("patients.date_of_birth");
  const phoneAccess = useFieldAccess("patients.phone");
  const emailAccess = useFieldAccess("patients.email");
  const addressAccess = useFieldAccess("patients.address");
  const patientNameAccess = mostRestrictedFieldAccess([
    firstNameAccess,
    middleNameAccess,
    lastNameAccess,
  ]);

  const { data: patient, isLoading } = useQuery({
    queryKey: ["patient", patientId],
    queryFn: () => patientService.getPatient(patientId),
  });

  const { data: visits } = useQuery({
    queryKey: ["patient", patientId, "visits"],
    queryFn: () => patientService.listPatientVisits(patientId),
    enabled: Boolean(patientId),
  });

  const { data: allergies } = useQuery({
    queryKey: ["patient", patientId, "allergies"],
    queryFn: () => patientService.listPatientAllergies(patientId),
    enabled: Boolean(patientId),
  });

  const { data: prescriptions } = useQuery({
    queryKey: ["patient", patientId, "prescriptions"],
    queryFn: () => patientService.listPatientPrescriptions(patientId),
    enabled: Boolean(patientId),
  });

  const { data: invoices } = useQuery({
    queryKey: ["patient", patientId, "invoices"],
    queryFn: () => patientService.listPatientInvoices(patientId),
    enabled: Boolean(patientId),
  });

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" />
        <Text variant="bodyMedium" style={styles.loadingText}>
          Loading patient details...
        </Text>
      </SafeAreaView>
    );
  }

  if (!patient) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <Avatar.Icon size={64} icon="account-off" style={styles.errorIcon} />
        <Text variant="titleMedium">Patient not found</Text>
      </SafeAreaView>
    );
  }

  const rawFullName = `${patient.first_name} ${patient.last_name}`;
  const fullName = protectedField(patientNameAccess, rawFullName, "name", "Unknown patient");
  const initials =
    patientNameAccess === "hidden" || patientNameAccess === "mask"
      ? "PT"
      : `${patient.first_name.charAt(0)}${patient.last_name.charAt(0)}`.toUpperCase();
  const protectedUhid = protectedField(uhidAccess, patient.uhid, "identifier", "No UHID");
  const protectedPhone = protectedField(phoneAccess, patient.phone, "phone");
  const protectedEmail = protectedField(emailAccess, patient.email, "email");
  const addressText = formatAddress(patient.address);
  const protectedAddress =
    addressText === "Not specified"
      ? addressText
      : protectedField(addressAccess, addressText, "text");
  const ageLabel = protectedAge(dobAccess, patient.date_of_birth);
  const dobLabel = protectedDateOfBirth(dobAccess, patient.date_of_birth);

  const visitsList: PatientVisitRow[] = visits || [];
  const activeOpdVisit = visitsList.find(
    (visit) => visit.encounter_type === "opd" && ACTIVE_VISIT_STATUSES.has(visit.status),
  );
  const activeEncounterId = activeOpdVisit?.id ?? null;
  const prescriptionList = prescriptions ?? [];
  const invoiceList = invoices ?? [];
  const hasMedicationOrder =
    prescriptionList.length > 0 || visitsList.some((visit) => (visit.prescription_count ?? 0) > 0);
  const hasBillingInvoice = invoiceList.length > 0;
  const hasFinalizedInvoice = invoiceList.some(
    (invoice) =>
      invoice.status === "issued" ||
      invoice.status === "partially_paid" ||
      invoice.status === "paid",
  );
  const hasPaymentReceived = invoiceList.some(
    (invoice) =>
      invoice.status === "paid" ||
      invoice.status === "partially_paid" ||
      Number.parseFloat(invoice.paid_amount || "0") > 0,
  );
  const pendingInvoiceCount = invoiceList.filter(
    (invoice) =>
      invoice.status === "draft" ||
      invoice.status === "issued" ||
      invoice.status === "partially_paid",
  ).length;
  const completedEvents = [
    ...(hasMedicationOrder ? ["order.created"] : []),
    ...(hasBillingInvoice ? ["billing.invoice.created"] : []),
    ...(hasFinalizedInvoice ? ["billing.invoice.finalized"] : []),
    ...(hasPaymentReceived ? ["billing.payment.received"] : []),
  ];
  const journeyContext: ClinicalJourneyContext = {
    patientId,
    isDeceased: patient.is_deceased,
    activeEncounterId,
    activeOrderContext: activeEncounterId ? "opd" : null,
    completedEvents,
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Patient Header Card */}
        <Surface style={styles.headerCard} elevation={2}>
          <View style={styles.headerRow}>
            <Avatar.Text size={64} label={initials} style={styles.avatar} />
            <View style={styles.headerInfo}>
              <Text variant="headlineSmall" style={styles.patientName}>
                {fullName}
              </Text>
              <Text variant="bodyMedium" style={styles.uhid}>
                {protectedUhid}
              </Text>
              <View style={styles.chips}>
                <Chip compact icon="calendar">
                  {ageLabel}
                </Chip>
                {patient.gender && (
                  <Chip compact icon={patient.gender === "male" ? "gender-male" : "gender-female"}>
                    {patient.gender}
                  </Chip>
                )}
                {patient.blood_group && (
                  <Chip compact icon="water" style={styles.bloodChip}>
                    {patient.blood_group}
                  </Chip>
                )}
              </View>
            </View>
          </View>

          {/* Contact Info */}
          {protectedPhone !== "Not specified" && (
            <View style={styles.contactRow}>
              <Avatar.Icon size={32} icon="phone" style={styles.contactIcon} />
              <Text variant="bodyMedium">{protectedPhone}</Text>
            </View>
          )}
          {protectedEmail !== "Not specified" && (
            <View style={styles.contactRow}>
              <Avatar.Icon size={32} icon="email" style={styles.contactIcon} />
              <Text variant="bodyMedium">{protectedEmail}</Text>
            </View>
          )}
        </Surface>

        <Surface style={styles.actionsPanel} elevation={1}>
          <View style={styles.actionsHeader}>
            <Text variant="titleSmall" style={styles.actionsTitle}>
              Care Actions
            </Text>
            <View style={styles.actionChips}>
              {activeOpdVisit && (
                <Chip compact icon="stethoscope" mode="outlined">
                  Active OPD
                </Chip>
              )}
              {hasMedicationOrder && (
                <Chip compact icon="pill" mode="outlined">
                  Rx handoff
                </Chip>
              )}
              {pendingInvoiceCount > 0 && (
                <Chip compact icon="receipt" mode="outlined">
                  {pendingInvoiceCount} bill{pendingInvoiceCount === 1 ? "" : "s"}
                </Chip>
              )}
            </View>
          </View>
          <View style={styles.actionsRow}>
            <Button
              mode="contained-tonal"
              icon="clipboard-plus"
              disabled={!activeEncounterId}
              onPress={() =>
                navigation.navigate("Vitals", {
                  encounterId: activeEncounterId ?? undefined,
                  patientId,
                })
              }
              style={styles.actionButton}
            >
              Vitals
            </Button>
          </View>
          {!activeEncounterId && (
            <Text variant="bodySmall" style={styles.actionsHint}>
              Open an OPD encounter before recording vitals, notes, prescriptions, or lab orders.
            </Text>
          )}
          <Text variant="bodySmall" style={styles.actionsHint}>
            Mobile handoffs activate from OPD, prescription, invoice, and payment events.
          </Text>
          <PatientJourneyActions context={journeyContext} navigation={navigation} />
        </Surface>

        {/* Allergies Alert */}
        {allergies && allergies.length > 0 && (
          <Card style={styles.alertCard}>
            <Card.Content>
              <View style={styles.alertHeader}>
                <Avatar.Icon size={24} icon="alert" style={styles.alertIcon} color="#C8102E" />
                <Text variant="titleSmall" style={styles.alertTitle}>
                  Allergies
                </Text>
              </View>
              <View style={styles.allergyChips}>
                {allergies.map((allergy) => (
                  <Chip
                    key={allergy.id}
                    mode="flat"
                    style={styles.allergyChip}
                    textStyle={styles.allergyText}
                  >
                    {allergy.allergen_name}
                  </Chip>
                ))}
              </View>
            </Card.Content>
          </Card>
        )}

        {/* Recent Visits */}
        <Card style={styles.sectionCard}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Recent Visits
            </Text>
            <Divider style={styles.divider} />

            {visitsList.length > 0 ? (
              visitsList.map((visit) => (
                <List.Item
                  key={visit.id}
                  title={visit.department_name || "Consultation"}
                  description={new Date(visit.encounter_date).toLocaleDateString()}
                  left={(props) => <List.Icon {...props} icon="calendar-clock" />}
                  right={() => <Chip compact>{visit.encounter_type}</Chip>}
                />
              ))
            ) : (
              <View style={styles.emptySection}>
                <Text variant="bodyMedium" style={styles.emptyText}>
                  No recent visits
                </Text>
              </View>
            )}
          </Card.Content>
        </Card>

        {/* Patient Info */}
        <Card style={styles.sectionCard}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Patient Information
            </Text>
            <Divider style={styles.divider} />

            <List.Item
              title="Date of Birth"
              description={dobLabel}
              left={(props) => <List.Icon {...props} icon="cake-variant" />}
            />
            <List.Item
              title="Marital Status"
              description={patient.marital_status || "Not specified"}
              left={(props) => <List.Icon {...props} icon="account-heart" />}
            />
            <List.Item
              title="Occupation"
              description={patient.occupation || "Not specified"}
              left={(props) => <List.Icon {...props} icon="briefcase" />}
            />
            <List.Item
              title="Address"
              description={protectedAddress}
              left={(props) => <List.Icon {...props} icon="map-marker" />}
            />
          </Card.Content>
        </Card>
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
    backgroundColor: "#fff5f5",
    marginBottom: 8,
  },
  scrollContent: {
    padding: 16,
  },
  headerCard: {
    padding: 16,
    borderRadius: 16,
  },
  headerRow: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 16,
  },
  avatar: {
    backgroundColor: "#0F766E",
  },
  headerInfo: {
    flex: 1,
  },
  patientName: {
    fontWeight: "bold",
  },
  uhid: {
    opacity: 0.6,
    marginTop: 2,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  bloodChip: {
    backgroundColor: "#fff5f5",
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 8,
  },
  contactIcon: {
    backgroundColor: "#e7f5ff",
  },
  actionsPanel: {
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
  },
  actionsHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
  },
  actionsTitle: {
    fontWeight: "600",
  },
  actionChips: {
    flexDirection: "row",
    flexShrink: 1,
    flexWrap: "wrap",
    gap: 6,
    justifyContent: "flex-end",
  },
  actionsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
    borderRadius: 12,
  },
  actionsHint: {
    marginTop: 8,
    opacity: 0.65,
  },
  alertCard: {
    marginTop: 16,
    backgroundColor: "#fff5f5",
    borderRadius: 12,
  },
  alertHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  alertIcon: {
    backgroundColor: "#ffe3e3",
  },
  alertTitle: {
    color: "#C8102E",
    fontWeight: "600",
  },
  allergyChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  allergyChip: {
    backgroundColor: "#ffe3e3",
  },
  allergyText: {
    color: "#c92a2a",
  },
  sectionCard: {
    marginTop: 16,
    borderRadius: 12,
  },
  sectionTitle: {
    fontWeight: "600",
  },
  divider: {
    marginVertical: 12,
  },
  emptySection: {
    padding: 16,
    alignItems: "center",
  },
  emptyText: {
    opacity: 0.6,
  },
});
