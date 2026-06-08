import { useFieldAccess, useHasPermission } from "@medbrains/stores";
import type {
  AdmissionRow,
  CampRegistration,
  ErVisit,
  FieldAccessLevel,
  Patient,
} from "@medbrains/types";
import { P } from "@medbrains/types";
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
import type {
  CareContextHandoff,
  CareContextModule,
  PatientCareContextRouteParams,
} from "../../navigation/careContextParams";
import { prioritizeCampRegistrationsForRoute } from "../../navigation/careContextParams";
import { patientService } from "../../services/patient.service";
import { MEDBRAINS_COLORS } from "../../theme/paper-theme";

interface PatientCareContextScreenProps {
  route: {
    params: PatientCareContextRouteParams;
  };
  navigation: {
    navigate: (screen: string, params?: Record<string, unknown>) => void;
  };
}

const HIDDEN_FIELD_TEXT = "Restricted";

function formatStatus(status: string): string {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not recorded" : date.toLocaleString();
}

function protectedField(
  access: FieldAccessLevel,
  value: string | null | undefined,
  kind: "identifier" | "name" | "text",
  fallback: string,
): string {
  const display = fieldAccessText(access, value, kind);
  if (display === HIDDEN_FIELD_TEXT) return display;
  return display === "—" ? fallback : display;
}

function patientName(patient: Patient | undefined, access: FieldAccessLevel): string {
  if (!patient) return "Patient context";
  return protectedField(access, `${patient.first_name} ${patient.last_name}`, "name", "Patient");
}

function patientUhid(patient: Patient | undefined, access: FieldAccessLevel): string {
  if (!patient) return "Patient identity";
  return protectedField(access, patient.uhid, "identifier", "No UHID");
}

function moduleIcon(moduleName: CareContextModule): string {
  if (moduleName === "ipd") return "bed";
  if (moduleName === "emergency") return "ambulance";
  return "account-group";
}

function moduleTitle(moduleName: CareContextModule, handoff: CareContextHandoff | undefined) {
  if (moduleName === "ipd") {
    return handoff === "admit" ? "IPD admission handoff" : "IPD care context";
  }
  if (moduleName === "emergency") {
    return handoff === "open_mlc" ? "MLC handoff" : "Emergency handoff";
  }
  return "Camp continuity handoff";
}

function moduleSubtitle(moduleName: CareContextModule) {
  if (moduleName === "ipd") {
    return "Review admission status, bed state, and inpatient handoff details.";
  }
  if (moduleName === "emergency") {
    return "Review emergency visits, triage state, and MLC-sensitive context.";
  }
  return "Review outreach registration and screening continuity for this patient.";
}

function permissionHint(moduleName: CareContextModule) {
  if (moduleName === "ipd") {
    return "IPD admission list permission is required to show inpatient records.";
  }
  if (moduleName === "emergency") {
    return "Emergency visit list permission is required to show ER records.";
  }
  return "Camp registration list permission is required to show outreach records.";
}

function unavailableMessage(moduleName: CareContextModule) {
  if (moduleName === "ipd") return "The latest IPD records could not be loaded.";
  if (moduleName === "emergency") return "The latest emergency records could not be loaded.";
  return "The latest camp records could not be loaded.";
}

function renderEmptyState(icon: string, title: string, message: string) {
  return (
    <View style={styles.emptyState}>
      <Avatar.Icon size={48} icon={icon} style={styles.emptyIcon} />
      <Text variant="titleSmall">{title}</Text>
      <Text variant="bodySmall" style={styles.emptyText}>
        {message}
      </Text>
    </View>
  );
}

function renderPermissionState(moduleName: CareContextModule) {
  return renderEmptyState("shield-lock-outline", "Restricted context", permissionHint(moduleName));
}

function activeAdmissionCount(admissions: AdmissionRow[]) {
  return admissions.filter((admission) => admission.status === "admitted").length;
}

function activeEmergencyCount(visits: ErVisit[]) {
  return visits.filter((visit) =>
    ["registered", "triaged", "in_treatment", "observation"].includes(visit.status),
  ).length;
}

function activeCampCount(registrations: CampRegistration[]) {
  return registrations.filter((registration) => registration.status !== "no_show").length;
}

export function PatientCareContextScreen({ route, navigation }: PatientCareContextScreenProps) {
  const theme = useTheme();
  const {
    campId,
    campRegistrationId,
    erVisitId,
    handoff,
    module: moduleName,
    patientId,
  } = route.params;
  const canListIpdAdmissions = useHasPermission(P.IPD.ADMISSIONS_LIST);
  const canListEmergencyVisits = useHasPermission(P.EMERGENCY.VISITS_LIST);
  const canListCampRegistrations = useHasPermission(P.CAMP.REGISTRATIONS_LIST);
  const uhidAccess = useFieldAccess("patients.uhid");
  const firstNameAccess = useFieldAccess("patients.first_name");
  const middleNameAccess = useFieldAccess("patients.middle_name");
  const lastNameAccess = useFieldAccess("patients.last_name");
  const patientNameAccess = mostRestrictedFieldAccess([
    firstNameAccess,
    middleNameAccess,
    lastNameAccess,
  ]);

  const canListCurrentModule =
    (moduleName === "ipd" && canListIpdAdmissions) ||
    (moduleName === "emergency" && canListEmergencyVisits) ||
    (moduleName === "camp" && canListCampRegistrations);

  const {
    data: patient,
    isError: isPatientError,
    isLoading: isPatientLoading,
  } = useQuery({
    queryKey: ["patient", patientId, "care-context"],
    queryFn: () => patientService.getPatient(patientId),
    enabled: Boolean(patientId),
  });

  const admissionsQuery = useQuery({
    queryKey: ["patient", patientId, "care-context", "admissions"],
    queryFn: () =>
      patientService.listAdmissions({
        page: "1",
        patient_id: patientId,
        per_page: "10",
      }),
    enabled: Boolean(patientId) && moduleName === "ipd" && canListIpdAdmissions,
  });

  const emergencyVisitsQuery = useQuery({
    queryKey: ["patient", patientId, "care-context", "emergency-visits"],
    queryFn: () => patientService.listErVisits({ patient_id: patientId }),
    enabled: Boolean(patientId) && moduleName === "emergency" && canListEmergencyVisits,
  });

  const campRegistrationsQuery = useQuery({
    queryKey: ["patient", patientId, "care-context", "camp-registrations"],
    queryFn: () => patientService.listCampRegistrations({ patient_id: patientId }),
    enabled: Boolean(patientId) && moduleName === "camp" && canListCampRegistrations,
  });

  const admissions = admissionsQuery.data?.admissions ?? [];
  const emergencyVisits = emergencyVisitsQuery.data ?? [];
  const orderedEmergencyVisits = erVisitId
    ? [...emergencyVisits].sort((left, right) => {
        if (left.id === erVisitId) return -1;
        if (right.id === erVisitId) return 1;
        return 0;
      })
    : emergencyVisits;
  const campRegistrations = campRegistrationsQuery.data ?? [];
  const orderedCampRegistrations = prioritizeCampRegistrationsForRoute(campRegistrations, {
    campId,
    campRegistrationId,
  });
  const isModuleLoading =
    admissionsQuery.isLoading || emergencyVisitsQuery.isLoading || campRegistrationsQuery.isLoading;
  const isModuleError =
    (moduleName === "ipd" && admissionsQuery.isError) ||
    (moduleName === "emergency" && emergencyVisitsQuery.isError) ||
    (moduleName === "camp" && campRegistrationsQuery.isError);
  const activeCount =
    moduleName === "ipd"
      ? activeAdmissionCount(admissions)
      : moduleName === "emergency"
        ? activeEmergencyCount(emergencyVisits)
        : activeCampCount(campRegistrations);

  function renderIpdSection() {
    if (!canListIpdAdmissions) return renderPermissionState(moduleName);
    if (admissions.length === 0) {
      return renderEmptyState("bed-empty", "No IPD records", "No admissions match this patient.");
    }

    return (
      <View style={styles.recordList}>
        {admissions.map((admission) => (
          <Card key={admission.id} style={styles.card}>
            <Card.Content>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitle}>
                  <Text variant="titleSmall">{admission.ward_name ?? "Ward pending"}</Text>
                  <Text variant="bodySmall" style={styles.mutedText}>
                    Admitted {formatDateTime(admission.admitted_at)}
                  </Text>
                </View>
                <Chip compact mode="outlined">
                  {formatStatus(admission.status)}
                </Chip>
              </View>
              <Divider style={styles.divider} />
              <List.Item
                title={admission.bed_id ? "Bed assigned" : "Bed pending"}
                description={admission.bed_id ?? "Admission cannot proceed to bedside orders yet"}
                left={(props) => <List.Icon {...props} icon="bed" />}
              />
              <List.Item
                title="Admitting doctor"
                description={admission.admitting_doctor || "Not recorded"}
                left={(props) => <List.Icon {...props} icon="doctor" />}
              />
              {admission.encounter_id && (
                <Button
                  mode="contained-tonal"
                  icon="clipboard-pulse"
                  onPress={() =>
                    navigation.navigate("Vitals", {
                      encounterId: admission.encounter_id,
                      patientId,
                    })
                  }
                  style={styles.inlineButton}
                >
                  Record vitals
                </Button>
              )}
            </Card.Content>
          </Card>
        ))}
      </View>
    );
  }

  function renderEmergencySection() {
    if (!canListEmergencyVisits) return renderPermissionState(moduleName);
    if (emergencyVisits.length === 0) {
      return renderEmptyState(
        "ambulance",
        "No emergency records",
        "No ER visits match this patient.",
      );
    }

    return (
      <View style={styles.recordList}>
        {orderedEmergencyVisits.map((visit) => {
          const isTargetVisit = Boolean(erVisitId && visit.id === erVisitId);

          return (
            <Card
              key={visit.id}
              style={[
                styles.card,
                visit.is_mlc || (handoff === "open_mlc" && isTargetVisit)
                  ? styles.warningCard
                  : null,
              ]}
            >
              <Card.Content>
                <View style={styles.cardHeader}>
                  <View style={styles.cardTitle}>
                    <Text variant="titleSmall">{visit.visit_number}</Text>
                    <Text variant="bodySmall" style={styles.mutedText}>
                      Arrived {formatDateTime(visit.arrival_time)}
                    </Text>
                  </View>
                  <View style={styles.statusChips}>
                    <Chip compact mode="outlined">
                      {formatStatus(visit.status)}
                    </Chip>
                    {isTargetVisit && (
                      <Chip compact icon="link-variant" style={styles.selectedChip}>
                        Selected
                      </Chip>
                    )}
                    {visit.is_mlc && (
                      <Chip compact icon="file-alert" style={styles.warningChip}>
                        MLC
                      </Chip>
                    )}
                  </View>
                </View>
                <Divider style={styles.divider} />
                <List.Item
                  title="Chief complaint"
                  description={visit.chief_complaint ?? "Not recorded"}
                  left={(props) => <List.Icon {...props} icon="clipboard-text" />}
                />
                <List.Item
                  title="Triage"
                  description={visit.triage_level ? formatStatus(visit.triage_level) : "Unassigned"}
                  left={(props) => <List.Icon {...props} icon="alert-decagram" />}
                />
                {visit.bay_number && (
                  <List.Item
                    title="Bay"
                    description={visit.bay_number}
                    left={(props) => <List.Icon {...props} icon="hospital-box" />}
                  />
                )}
              </Card.Content>
            </Card>
          );
        })}
      </View>
    );
  }

  function renderCampSection() {
    if (!canListCampRegistrations) return renderPermissionState(moduleName);
    if (campRegistrations.length === 0) {
      return renderEmptyState(
        "account-group",
        "No camp records",
        "No outreach registrations match this patient.",
      );
    }

    return (
      <View style={styles.recordList}>
        {orderedCampRegistrations.map((registration) => (
          <Card key={registration.id} style={styles.card}>
            <Card.Content>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitle}>
                  <Text variant="titleSmall">{registration.registration_number}</Text>
                  <Text variant="bodySmall" style={styles.mutedText}>
                    Registered {formatDateTime(registration.created_at)}
                  </Text>
                </View>
                <Chip compact mode="outlined">
                  {formatStatus(registration.status)}
                </Chip>
              </View>
              <Divider style={styles.divider} />
              <List.Item
                title="Service line"
                description={registration.service_line ?? "Not recorded"}
                left={(props) => <List.Icon {...props} icon="hospital-building" />}
              />
              <List.Item
                title="Chief complaint"
                description={registration.chief_complaint ?? "Not recorded"}
                left={(props) => <List.Icon {...props} icon="clipboard-text" />}
              />
            </Card.Content>
          </Card>
        ))}
      </View>
    );
  }

  function renderModuleSection() {
    if (isModuleLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <Text variant="bodyMedium" style={styles.mutedText}>
            Loading handoff context...
          </Text>
        </View>
      );
    }

    if (isModuleError) {
      return renderEmptyState(
        "alert-circle-outline",
        "Context unavailable",
        unavailableMessage(moduleName),
      );
    }

    if (moduleName === "ipd") return renderIpdSection();
    if (moduleName === "emergency") return renderEmergencySection();
    return renderCampSection();
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Surface style={styles.headerPanel} elevation={1}>
          <Avatar.Icon size={44} icon={moduleIcon(moduleName)} style={styles.headerIcon} />
          <View style={styles.headerText}>
            <Text variant="titleMedium" style={styles.headerTitle}>
              {moduleTitle(moduleName, handoff)}
            </Text>
            <Text variant="bodySmall" style={styles.mutedText}>
              {moduleSubtitle(moduleName)}
            </Text>
          </View>
          <Chip compact mode="outlined">
            {activeCount} active
          </Chip>
        </Surface>

        <Surface style={styles.identityPanel} elevation={0}>
          <View style={styles.identityText}>
            <Text variant="titleSmall">
              {isPatientLoading
                ? "Loading patient..."
                : isPatientError
                  ? "Patient identity unavailable"
                  : patientName(patient, patientNameAccess)}
            </Text>
            <Text variant="bodySmall" style={styles.mutedText}>
              {isPatientError ? "UHID unavailable" : patientUhid(patient, uhidAccess)}
            </Text>
          </View>
          <Chip compact icon={canListCurrentModule ? "shield-check" : "shield-lock-outline"}>
            {canListCurrentModule ? "Linked" : "Restricted"}
          </Chip>
        </Surface>

        {renderModuleSection()}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
  },
  cardHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
  },
  cardTitle: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  divider: {
    marginVertical: 10,
  },
  emptyIcon: {
    backgroundColor: MEDBRAINS_COLORS.panel,
  },
  emptyState: {
    alignItems: "center",
    gap: 8,
    padding: 32,
  },
  emptyText: {
    opacity: 0.65,
    textAlign: "center",
  },
  headerIcon: {
    backgroundColor: MEDBRAINS_COLORS.navActiveBg,
  },
  headerPanel: {
    alignItems: "center",
    borderRadius: 12,
    flexDirection: "row",
    gap: 12,
    padding: 14,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontWeight: "700",
  },
  identityPanel: {
    alignItems: "center",
    backgroundColor: MEDBRAINS_COLORS.panel,
    borderRadius: 12,
    flexDirection: "row",
    gap: 10,
    padding: 12,
  },
  identityText: {
    flex: 1,
  },
  inlineButton: {
    marginTop: 8,
  },
  loadingContainer: {
    alignItems: "center",
    gap: 12,
    padding: 32,
  },
  mutedText: {
    opacity: 0.65,
  },
  recordList: {
    gap: 12,
  },
  scrollContent: {
    gap: 12,
    padding: 16,
  },
  statusChips: {
    alignItems: "flex-end",
    gap: 6,
  },
  selectedChip: {
    backgroundColor: MEDBRAINS_COLORS.navActiveBg,
  },
  warningCard: {
    borderColor: MEDBRAINS_COLORS.statusWarning,
    borderWidth: 1,
  },
  warningChip: {
    backgroundColor: MEDBRAINS_COLORS.statusWarningBg,
  },
});
