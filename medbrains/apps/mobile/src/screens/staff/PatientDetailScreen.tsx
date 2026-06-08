import { useFieldAccess, useHasPermission } from "@medbrains/stores";
import type {
  CampRegistration,
  ClinicalEventName,
  ClinicalJourneyContext,
  ErVisit,
  ErVisitStatus,
  FieldAccessLevel,
  Gender,
  MaritalStatus,
  PatientVisitRow,
} from "@medbrains/types";
import {
  activeBillingInvoiceIdForJourney,
  activePatientPharmacyOrderIdForJourney,
  activePatientPharmacyRxQueueIdForJourney,
  billingInvoiceHasReceivedPayment,
  billingInvoiceIsFinalized,
  billingInvoiceRequiresFollowUp,
  deriveCampJourneyCompletedEvents,
  hasReviewedPatientPharmacyPrescriptionForJourney,
  P,
} from "@medbrains/types";
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
import { PatientFlowNavigator, PatientJourneyActions } from "../../components";
import {
  MOBILE_PATIENT_DETAIL_TEXT,
  mobilePatientJourneyText,
} from "../../components/patientJourneyText";
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
const ACTIVE_ER_VISIT_STATUSES = new Set<ErVisitStatus>([
  "registered",
  "triaged",
  "in_treatment",
  "observation",
]);
const PATIENT_DETAIL_TEXT = MOBILE_PATIENT_DETAIL_TEXT;

function patientDetailMessage(
  key: string,
  values?: Record<string, string | number | boolean>,
): string {
  return mobilePatientJourneyText(key, values);
}

function calculateAge(dob: string): string {
  const birthDate = new Date(dob);
  if (Number.isNaN(birthDate.getTime())) {
    return patientDetailMessage(PATIENT_DETAIL_TEXT.fields.unknown);
  }
  const today = new Date();
  let years = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    years--;
  }
  const key =
    years === 1
      ? PATIENT_DETAIL_TEXT.fields.ageYearSingular
      : PATIENT_DETAIL_TEXT.fields.ageYearPlural;
  return patientDetailMessage(key, { count: years });
}

function protectedField(
  access: FieldAccessLevel,
  value: string | null | undefined,
  kind: "email" | "identifier" | "name" | "phone" | "text" = "text",
  fallbackKey: string = PATIENT_DETAIL_TEXT.fields.notSpecified,
): string {
  if (access === "hidden") return patientDetailMessage(PATIENT_DETAIL_TEXT.fields.hiddenField);
  if (!value?.trim()) return patientDetailMessage(fallbackKey);
  if (access === "mask" && kind === "text") {
    return patientDetailMessage(PATIENT_DETAIL_TEXT.fields.maskedField);
  }
  const display = fieldAccessText(access, value, kind);
  return display === "\u2014" ? patientDetailMessage(fallbackKey) : display;
}

function protectedDateOfBirth(access: FieldAccessLevel, value: string | null | undefined): string {
  if (access === "hidden") return patientDetailMessage(PATIENT_DETAIL_TEXT.fields.hiddenField);
  if (!value) return patientDetailMessage(PATIENT_DETAIL_TEXT.fields.notSpecified);
  if (access === "mask") return patientDetailMessage(PATIENT_DETAIL_TEXT.fields.dateMasked);
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? patientDetailMessage(PATIENT_DETAIL_TEXT.fields.unknown)
    : date.toLocaleDateString();
}

function protectedAge(access: FieldAccessLevel, value: string | null | undefined): string {
  if (access === "hidden") return patientDetailMessage(PATIENT_DETAIL_TEXT.fields.hiddenField);
  if (!value) return patientDetailMessage(PATIENT_DETAIL_TEXT.fields.unknown);
  if (access === "mask") return patientDetailMessage(PATIENT_DETAIL_TEXT.fields.ageMasked);
  return calculateAge(value);
}

function isAddressRecord(
  value: unknown,
): value is { city?: unknown; line1?: unknown; pincode?: unknown; state?: unknown } {
  return Boolean(value) && typeof value === "object";
}

function formatAddress(addr: unknown): string | null {
  if (!isAddressRecord(addr)) return null;
  const parts = [addr.line1, addr.city, addr.state, addr.pincode].filter(
    (part): part is string => typeof part === "string" && part.trim().length > 0,
  );
  return parts.length > 0 ? parts.join(", ") : null;
}

function formatCampRegistrationStatus(status: CampRegistration["status"]): string {
  if (status === "converted") return patientDetailMessage(PATIENT_DETAIL_TEXT.status.campConverted);
  if (status === "registered") {
    return patientDetailMessage(PATIENT_DETAIL_TEXT.status.campRegistered);
  }
  if (status === "referred") return patientDetailMessage(PATIENT_DETAIL_TEXT.status.campReferred);
  if (status === "screened") return patientDetailMessage(PATIENT_DETAIL_TEXT.status.campScreened);
  return patientDetailMessage(PATIENT_DETAIL_TEXT.fields.unknown);
}

function formatEncounterType(encounterType: PatientVisitRow["encounter_type"]): string {
  if (encounterType === "emergency") {
    return patientDetailMessage(PATIENT_DETAIL_TEXT.status.emergency);
  }
  if (encounterType === "ipd") return patientDetailMessage(PATIENT_DETAIL_TEXT.status.ipd);
  return patientDetailMessage(PATIENT_DETAIL_TEXT.status.opd);
}

function formatGender(gender: Gender): string {
  if (gender === "female") return patientDetailMessage(PATIENT_DETAIL_TEXT.status.female);
  if (gender === "male") return patientDetailMessage(PATIENT_DETAIL_TEXT.status.male);
  if (gender === "other") return patientDetailMessage(PATIENT_DETAIL_TEXT.status.other);
  return patientDetailMessage(PATIENT_DETAIL_TEXT.status.unknown);
}

function formatMaritalStatus(status: MaritalStatus | null): string {
  if (status === "divorced") {
    return patientDetailMessage(PATIENT_DETAIL_TEXT.status.maritalDivorced);
  }
  if (status === "domestic_partner") {
    return patientDetailMessage(PATIENT_DETAIL_TEXT.status.maritalDomesticPartner);
  }
  if (status === "married") return patientDetailMessage(PATIENT_DETAIL_TEXT.status.maritalMarried);
  if (status === "separated") {
    return patientDetailMessage(PATIENT_DETAIL_TEXT.status.maritalSeparated);
  }
  if (status === "single") return patientDetailMessage(PATIENT_DETAIL_TEXT.status.maritalSingle);
  if (status === "widowed") return patientDetailMessage(PATIENT_DETAIL_TEXT.status.maritalWidowed);
  if (status === "unknown") return patientDetailMessage(PATIENT_DETAIL_TEXT.status.maritalUnknown);
  return patientDetailMessage(PATIENT_DETAIL_TEXT.fields.notSpecified);
}

function shouldShowProtectedField(
  access: FieldAccessLevel,
  value: string | null | undefined,
): boolean {
  return access === "hidden" || Boolean(value?.trim());
}

export function PatientDetailScreen({ route, navigation }: PatientDetailScreenProps) {
  const theme = useTheme();
  const { patientId } = route.params;
  const canViewIpdAdmissions = useHasPermission(P.IPD.ADMISSIONS_LIST);
  const canViewEmergencyVisits = useHasPermission(P.EMERGENCY.VISITS_LIST);
  const canViewCampRegistrations = useHasPermission(P.CAMP.REGISTRATIONS_LIST);
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

  const { data: admissionPage } = useQuery({
    queryKey: ["patient", patientId, "active-admissions"],
    queryFn: () =>
      patientService.listAdmissions({
        page: "1",
        patient_id: patientId,
        per_page: "1",
        status: "admitted",
      }),
    enabled: Boolean(patientId) && canViewIpdAdmissions,
  });

  const { data: erVisits } = useQuery({
    queryKey: ["patient", patientId, "emergency-visits"],
    queryFn: () => patientService.listErVisits({ patient_id: patientId }),
    enabled: Boolean(patientId) && canViewEmergencyVisits,
  });

  const { data: campRegistrations } = useQuery({
    queryKey: ["patient", patientId, "camp-registrations"],
    queryFn: () => patientService.listCampRegistrations({ patient_id: patientId }),
    enabled: Boolean(patientId) && canViewCampRegistrations,
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
          {patientDetailMessage(PATIENT_DETAIL_TEXT.loading.patientDetails)}
        </Text>
      </SafeAreaView>
    );
  }

  if (!patient) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <Avatar.Icon size={64} icon="account-off" style={styles.errorIcon} />
        <Text variant="titleMedium">
          {patientDetailMessage(PATIENT_DETAIL_TEXT.empty.patientNotFound)}
        </Text>
      </SafeAreaView>
    );
  }

  const rawFullName = `${patient.first_name} ${patient.last_name}`;
  const fullName = protectedField(
    patientNameAccess,
    rawFullName,
    "name",
    PATIENT_DETAIL_TEXT.fields.unknownPatient,
  );
  const initials =
    patientNameAccess === "hidden" || patientNameAccess === "mask"
      ? patientDetailMessage(PATIENT_DETAIL_TEXT.fields.patientInitials)
      : `${patient.first_name.charAt(0)}${patient.last_name.charAt(0)}`.toUpperCase();
  const protectedUhid = protectedField(
    uhidAccess,
    patient.uhid,
    "identifier",
    PATIENT_DETAIL_TEXT.fields.noUhid,
  );
  const protectedPhone = protectedField(phoneAccess, patient.phone, "phone");
  const protectedEmail = protectedField(emailAccess, patient.email, "email");
  const addressText = formatAddress(patient.address);
  const protectedAddress = protectedField(addressAccess, addressText, "text");
  const ageLabel = protectedAge(dobAccess, patient.date_of_birth);
  const dobLabel = protectedDateOfBirth(dobAccess, patient.date_of_birth);

  const visitsList: PatientVisitRow[] = visits || [];
  const erVisitList: ErVisit[] = erVisits ?? [];
  const campRegistrationList: CampRegistration[] = campRegistrations ?? [];
  const activeAdmission = admissionPage?.admissions[0] ?? null;
  const activeOpdVisit = visitsList.find(
    (visit) => visit.encounter_type === "opd" && ACTIVE_VISIT_STATUSES.has(visit.status),
  );
  const activeErVisit = erVisitList.find((visit) => ACTIVE_ER_VISIT_STATUSES.has(visit.status));
  const activeCampRegistration = campRegistrationList.find(
    (registration) => registration.status !== "no_show",
  );
  const activeCareEncounterId = activeAdmission
    ? (activeAdmission.encounter_id ?? null)
    : (activeOpdVisit?.id ?? null);
  const activeOrderContext = activeAdmission ? "ipd" : activeOpdVisit ? "opd" : null;
  const prescriptionList = prescriptions ?? [];
  const invoiceList = invoices ?? [];
  const hasMedicationOrder =
    prescriptionList.length > 0 || visitsList.some((visit) => (visit.prescription_count ?? 0) > 0);
  const hasBillingInvoice = invoiceList.length > 0;
  const hasFinalizedInvoice = invoiceList.some((invoice) =>
    billingInvoiceIsFinalized(invoice.status, invoice.total_amount, invoice.paid_amount),
  );
  const hasPaymentReceived = invoiceList.some((invoice) =>
    billingInvoiceHasReceivedPayment(invoice.status, invoice.total_amount, invoice.paid_amount),
  );
  const campCompletedEvents = deriveCampJourneyCompletedEvents(campRegistrationList);
  const pendingInvoiceCount = invoiceList.filter((invoice) =>
    billingInvoiceRequiresFollowUp(invoice.status, invoice.total_amount, invoice.paid_amount),
  ).length;
  const activeInvoiceId = activeBillingInvoiceIdForJourney(invoiceList);
  const activePharmacyOrderId = activePatientPharmacyOrderIdForJourney(prescriptionList);
  const activePharmacyRxQueueId = activePatientPharmacyRxQueueIdForJourney(prescriptionList);
  const hasReviewedPharmacyPrescription =
    hasReviewedPatientPharmacyPrescriptionForJourney(prescriptionList);
  const completedEvents: ClinicalEventName[] = [];
  if (hasMedicationOrder) completedEvents.push("order.created");
  completedEvents.push(...campCompletedEvents);
  if (hasReviewedPharmacyPrescription) {
    completedEvents.push("pharmacy.prescription.reviewed");
  }
  if (hasBillingInvoice) completedEvents.push("billing.invoice.created");
  if (hasFinalizedInvoice) completedEvents.push("billing.invoice.finalized");
  if (hasPaymentReceived) completedEvents.push("billing.payment.received");
  const journeyContext: ClinicalJourneyContext = {
    patientId,
    isDeceased: patient.is_deceased,
    activeEncounterId: activeCareEncounterId,
    activeAdmissionId: activeAdmission?.id ?? null,
    activeAdmissionStatus: activeAdmission?.status ?? null,
    activeBedId: activeAdmission?.bed_id,
    activeCampId: activeCampRegistration?.camp_id ?? null,
    activeCampRegistrationId: activeCampRegistration?.id ?? null,
    activeEmergencyVisitId: activeErVisit?.id ?? null,
    activeInvoiceId,
    activePharmacyOrderId,
    activePharmacyRxQueueId,
    activeOrderContext,
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
                    {formatGender(patient.gender)}
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
          {shouldShowProtectedField(phoneAccess, patient.phone) && (
            <View style={styles.contactRow}>
              <Avatar.Icon size={32} icon="phone" style={styles.contactIcon} />
              <Text variant="bodyMedium">{protectedPhone}</Text>
            </View>
          )}
          {shouldShowProtectedField(emailAccess, patient.email) && (
            <View style={styles.contactRow}>
              <Avatar.Icon size={32} icon="email" style={styles.contactIcon} />
              <Text variant="bodyMedium">{protectedEmail}</Text>
            </View>
          )}
        </Surface>

        <Surface style={styles.actionsPanel} elevation={1}>
          <View style={styles.actionsHeader}>
            <Text variant="titleSmall" style={styles.actionsTitle}>
              {patientDetailMessage(PATIENT_DETAIL_TEXT.actions.title)}
            </Text>
            <View style={styles.actionChips}>
              {activeOpdVisit && (
                <Chip compact icon="stethoscope" mode="outlined">
                  {patientDetailMessage(PATIENT_DETAIL_TEXT.actions.activeOpd)}
                </Chip>
              )}
              {activeAdmission && (
                <Chip compact icon="bed" mode="outlined">
                  {patientDetailMessage(PATIENT_DETAIL_TEXT.actions.activeIpd)}
                </Chip>
              )}
              {activeErVisit && (
                <Chip compact icon="ambulance" mode="outlined">
                  {patientDetailMessage(PATIENT_DETAIL_TEXT.actions.activeEr)}
                </Chip>
              )}
              {activeErVisit?.is_mlc && (
                <Chip compact icon="file-alert" mode="outlined">
                  {patientDetailMessage(PATIENT_DETAIL_TEXT.actions.mlc)}
                </Chip>
              )}
              {activeCampRegistration && (
                <Chip compact icon="account-group" mode="outlined">
                  {patientDetailMessage(PATIENT_DETAIL_TEXT.actions.campStatus, {
                    status: formatCampRegistrationStatus(activeCampRegistration.status),
                  })}
                </Chip>
              )}
              {activeAdmission && !activeAdmission.bed_id && (
                <Chip compact icon="alert" mode="outlined">
                  {patientDetailMessage(PATIENT_DETAIL_TEXT.actions.bedPending)}
                </Chip>
              )}
              {hasMedicationOrder && (
                <Chip compact icon="pill" mode="outlined">
                  {patientDetailMessage(PATIENT_DETAIL_TEXT.actions.rxHandoff)}
                </Chip>
              )}
              {pendingInvoiceCount > 0 && (
                <Chip compact icon="receipt" mode="outlined">
                  {patientDetailMessage(
                    pendingInvoiceCount === 1
                      ? PATIENT_DETAIL_TEXT.actions.pendingBillSingular
                      : PATIENT_DETAIL_TEXT.actions.pendingBillPlural,
                    { count: pendingInvoiceCount },
                  )}
                </Chip>
              )}
            </View>
          </View>
          <View style={styles.actionsRow}>
            <Button
              mode="contained-tonal"
              icon="clipboard-plus"
              disabled={!activeCareEncounterId}
              onPress={() =>
                navigation.navigate("Vitals", {
                  encounterId: activeCareEncounterId ?? undefined,
                  patientId,
                })
              }
              style={styles.actionButton}
            >
              {patientDetailMessage(PATIENT_DETAIL_TEXT.actions.vitals)}
            </Button>
          </View>
          {!activeCareEncounterId && (
            <Text variant="bodySmall" style={styles.actionsHint}>
              {patientDetailMessage(PATIENT_DETAIL_TEXT.actions.missingCareContextHint)}
            </Text>
          )}
          <Text variant="bodySmall" style={styles.actionsHint}>
            {patientDetailMessage(PATIENT_DETAIL_TEXT.actions.activationHint)}
          </Text>
          <PatientFlowNavigator active="patient" context={journeyContext} navigation={navigation} />
          <PatientJourneyActions context={journeyContext} navigation={navigation} />
        </Surface>

        {/* Allergies Alert */}
        {allergies && allergies.length > 0 && (
          <Card style={styles.alertCard}>
            <Card.Content>
              <View style={styles.alertHeader}>
                <Avatar.Icon size={24} icon="alert" style={styles.alertIcon} color="#C8102E" />
                <Text variant="titleSmall" style={styles.alertTitle}>
                  {patientDetailMessage(PATIENT_DETAIL_TEXT.sections.allergies)}
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
              {patientDetailMessage(PATIENT_DETAIL_TEXT.sections.recentVisits)}
            </Text>
            <Divider style={styles.divider} />

            {visitsList.length > 0 ? (
              visitsList.map((visit) => (
                <List.Item
                  key={visit.id}
                  title={
                    visit.department_name ||
                    patientDetailMessage(PATIENT_DETAIL_TEXT.visits.consultation)
                  }
                  description={new Date(visit.encounter_date).toLocaleDateString()}
                  left={(props) => <List.Icon {...props} icon="calendar-clock" />}
                  right={() => <Chip compact>{formatEncounterType(visit.encounter_type)}</Chip>}
                />
              ))
            ) : (
              <View style={styles.emptySection}>
                <Text variant="bodyMedium" style={styles.emptyText}>
                  {patientDetailMessage(PATIENT_DETAIL_TEXT.empty.noRecentVisits)}
                </Text>
              </View>
            )}
          </Card.Content>
        </Card>

        {/* Patient Info */}
        <Card style={styles.sectionCard}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              {patientDetailMessage(PATIENT_DETAIL_TEXT.sections.patientInformation)}
            </Text>
            <Divider style={styles.divider} />

            <List.Item
              title={patientDetailMessage(PATIENT_DETAIL_TEXT.fields.dateOfBirth)}
              description={dobLabel}
              left={(props) => <List.Icon {...props} icon="cake-variant" />}
            />
            <List.Item
              title={patientDetailMessage(PATIENT_DETAIL_TEXT.fields.maritalStatus)}
              description={formatMaritalStatus(patient.marital_status)}
              left={(props) => <List.Icon {...props} icon="account-heart" />}
            />
            <List.Item
              title={patientDetailMessage(PATIENT_DETAIL_TEXT.fields.occupation)}
              description={
                patient.occupation || patientDetailMessage(PATIENT_DETAIL_TEXT.fields.notSpecified)
              }
              left={(props) => <List.Icon {...props} icon="briefcase" />}
            />
            <List.Item
              title={patientDetailMessage(PATIENT_DETAIL_TEXT.fields.address)}
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
