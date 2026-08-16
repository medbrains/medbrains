import { useHasPermission } from "@medbrains/stores";
import type { PrescriptionHistoryItem, PrescriptionItem } from "@medbrains/types";
import { P } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Avatar,
  Card,
  Chip,
  Divider,
  Searchbar,
  SegmentedButtons,
  Surface,
  Text,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  MOBILE_PATIENT_PHARMACY_TEXT,
  mobilePatientJourneyText,
} from "../../components/patientJourneyText";
import { patientService } from "../../services/patient.service";

type PharmacyFilter = "recent" | "all";
type PharmacyHandoff = "dispense" | "queue";
const PATIENT_PHARMACY_TEXT = MOBILE_PATIENT_PHARMACY_TEXT;

interface PatientPharmacyScreenProps {
  route: {
    params: {
      handoff?: PharmacyHandoff;
      patientId: string;
      pharmacyOrderId?: string;
      pharmacyRxQueueId?: string;
    };
  };
}

function itemMatchesSearch(item: PrescriptionItem, search: string) {
  if (!search) return true;
  const value = search.toLowerCase();
  return (
    item.drug_name.toLowerCase().includes(value) ||
    item.dosage.toLowerCase().includes(value) ||
    item.frequency.toLowerCase().includes(value)
  );
}

function prescriptionMatchesSearch(item: PrescriptionHistoryItem, search: string) {
  if (!search) return true;
  const value = search.toLowerCase();
  return (
    item.doctor_name?.toLowerCase().includes(value) ||
    item.items.some((prescriptionItem) => itemMatchesSearch(prescriptionItem, search))
  );
}

function prescriptionMatchesHandoff(
  item: PrescriptionHistoryItem,
  pharmacyOrderId: string | undefined,
  pharmacyRxQueueId: string | undefined,
) {
  if (!pharmacyOrderId && !pharmacyRxQueueId) return false;
  return (
    item.pharmacy_order_id === pharmacyOrderId ||
    item.pharmacy_rx_queue_id === pharmacyRxQueueId ||
    item.prescription.id === pharmacyOrderId ||
    item.items.some((prescriptionItem) => prescriptionItem.prescription_id === pharmacyOrderId)
  );
}

function activeMedicationCount(prescriptions: PrescriptionHistoryItem[]) {
  return prescriptions.reduce(
    (count, item) =>
      count +
      item.items.filter((prescriptionItem) => prescriptionItem.item_status !== "discontinued")
        .length,
    0,
  );
}

function patientPharmacyText(
  key: string,
  values?: Record<string, string | number | boolean>,
): string {
  return mobilePatientJourneyText(key, values);
}

function handoffTitle(handoff: PharmacyHandoff | undefined): string {
  return patientPharmacyText(
    handoff === "dispense"
      ? PATIENT_PHARMACY_TEXT.handoff.dispenseTitle
      : PATIENT_PHARMACY_TEXT.handoff.pharmacyTitle,
  );
}

function handoffDescription(pharmacyOrderId?: string, pharmacyRxQueueId?: string): string {
  if (pharmacyOrderId) {
    return patientPharmacyText(PATIENT_PHARMACY_TEXT.handoff.dispenseDescription);
  }
  if (pharmacyRxQueueId) {
    return patientPharmacyText(PATIENT_PHARMACY_TEXT.handoff.queueDescription);
  }
  return patientPharmacyText(PATIENT_PHARMACY_TEXT.handoff.reviewDescription);
}

function itemCountText(count: number): string {
  const key =
    count === 1
      ? PATIENT_PHARMACY_TEXT.medication.itemCountSingular
      : PATIENT_PHARMACY_TEXT.medication.itemCountPlural;
  return patientPharmacyText(key, { count });
}

function medicationStatusText(status: string): string {
  if (status === "active") return patientPharmacyText(PATIENT_PHARMACY_TEXT.status.active);
  if (status === "changed") return patientPharmacyText(PATIENT_PHARMACY_TEXT.status.changed);
  if (status === "discontinued") {
    return patientPharmacyText(PATIENT_PHARMACY_TEXT.status.discontinued);
  }
  return patientPharmacyText(PATIENT_PHARMACY_TEXT.status.unknown);
}

export function PatientPharmacyScreen({ route }: PatientPharmacyScreenProps) {
  const canViewPatient = useHasPermission(P.PATIENTS.VIEW);
  const theme = useTheme();
  const { handoff, patientId, pharmacyOrderId, pharmacyRxQueueId } = route.params;
  const [filter, setFilter] = useState<PharmacyFilter>("recent");
  const [search, setSearch] = useState("");

  const {
    data = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["patient", "pharmacy", patientId],
    queryFn: () => patientService.listPatientPrescriptions(patientId),
    // Do not fetch what this user may not see — hiding it after
    // the fetch still leaves it in the response and in devtools.
    enabled: Boolean(patientId) && canViewPatient,
  });

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const filteredByDate =
    filter === "recent"
      ? data.filter(
          (item) =>
            new Date(item.encounter_date) >= thirtyDaysAgo ||
            prescriptionMatchesHandoff(item, pharmacyOrderId, pharmacyRxQueueId),
        )
      : data;
  const prescriptions = filteredByDate
    .filter(
      (item) =>
        prescriptionMatchesHandoff(item, pharmacyOrderId, pharmacyRxQueueId) ||
        prescriptionMatchesSearch(item, search),
    )
    .sort((left, right) => {
      const leftMatches = prescriptionMatchesHandoff(left, pharmacyOrderId, pharmacyRxQueueId);
      const rightMatches = prescriptionMatchesHandoff(right, pharmacyOrderId, pharmacyRxQueueId);
      if (leftMatches === rightMatches) return 0;
      return leftMatches ? -1 : 1;
    });
  const activeCount = activeMedicationCount(prescriptions);

  function renderPrescription({ item }: { item: PrescriptionHistoryItem }) {
    const prescriptionDate = new Date(item.encounter_date);
    const selectedForHandoff = prescriptionMatchesHandoff(item, pharmacyOrderId, pharmacyRxQueueId);
    const visibleItems = search
      ? item.items.filter((prescriptionItem) => itemMatchesSearch(prescriptionItem, search))
      : item.items;

    return (
      <Card style={[styles.card, selectedForHandoff && styles.selectedCard]}>
        <Card.Content>
          <View style={styles.cardHeader}>
            <Avatar.Icon size={36} icon="pill" style={styles.cardIcon} />
            <View style={styles.cardTitle}>
              <Text variant="titleMedium">
                {item.doctor_name ||
                  patientPharmacyText(PATIENT_PHARMACY_TEXT.medication.prescriberFallback)}
              </Text>
              <Text variant="bodySmall" style={styles.mutedText}>
                {prescriptionDate.toLocaleDateString()}
              </Text>
            </View>
            <View style={styles.cardChips}>
              {selectedForHandoff && (
                <Chip compact icon="link-variant" style={styles.selectedChip}>
                  {patientPharmacyText(PATIENT_PHARMACY_TEXT.medication.selectedOrder)}
                </Chip>
              )}
              <Chip compact mode="outlined">
                {itemCountText(visibleItems.length)}
              </Chip>
            </View>
          </View>
          <Divider style={styles.divider} />
          <View style={styles.medicationList}>
            {visibleItems.map((prescriptionItem) => (
              <View key={prescriptionItem.id} style={styles.medicationRow}>
                <View style={styles.medicationInfo}>
                  <Text variant="titleSmall" style={styles.drugName}>
                    {prescriptionItem.drug_name}
                  </Text>
                  <Text variant="bodySmall" style={styles.mutedText}>
                    {prescriptionItem.dosage} | {prescriptionItem.frequency}
                  </Text>
                  <Text variant="bodySmall" style={styles.mutedText}>
                    {prescriptionItem.route ? `${prescriptionItem.route} | ` : ""}
                    {prescriptionItem.duration}
                  </Text>
                </View>
                <Chip
                  compact
                  style={
                    prescriptionItem.item_status === "discontinued"
                      ? styles.discontinuedChip
                      : styles.activeChip
                  }
                >
                  {medicationStatusText(prescriptionItem.item_status)}
                </Chip>
              </View>
            ))}
          </View>
        </Card.Content>
      </Card>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Surface style={styles.handoffBanner} elevation={1}>
        <Avatar.Icon size={40} icon="pill" style={styles.handoffIcon} />
        <View style={styles.handoffText}>
          <Text variant="titleSmall">{handoffTitle(handoff)}</Text>
          <Text variant="bodySmall" style={styles.mutedText}>
            {handoffDescription(pharmacyOrderId, pharmacyRxQueueId)}
          </Text>
        </View>
        <Chip compact mode="outlined">
          {patientPharmacyText(PATIENT_PHARMACY_TEXT.handoff.activeCount, {
            count: activeCount,
          })}
        </Chip>
      </Surface>

      <View style={styles.searchContainer}>
        <Searchbar
          placeholder={patientPharmacyText(PATIENT_PHARMACY_TEXT.search.placeholder)}
          value={search}
          onChangeText={setSearch}
          style={styles.searchbar}
        />
      </View>

      <View style={styles.filterContainer}>
        <SegmentedButtons
          value={filter}
          onValueChange={(value) => setFilter(value as PharmacyFilter)}
          buttons={[
            {
              label: patientPharmacyText(PATIENT_PHARMACY_TEXT.filters.recent),
              value: "recent",
            },
            {
              label: patientPharmacyText(PATIENT_PHARMACY_TEXT.filters.allHistory),
              value: "all",
            },
          ]}
        />
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <Text variant="bodyMedium" style={styles.mutedText}>
            {patientPharmacyText(PATIENT_PHARMACY_TEXT.loading.context)}
          </Text>
        </View>
      ) : prescriptions.length > 0 ? (
        <FlatList
          data={prescriptions}
          keyExtractor={(item) => item.prescription.id}
          renderItem={renderPrescription}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onRefresh={refetch}
          refreshing={isLoading}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Avatar.Icon size={64} icon="pill-off" style={styles.emptyIcon} />
          <Text variant="titleMedium">
            {patientPharmacyText(PATIENT_PHARMACY_TEXT.empty.title)}
          </Text>
          <Text variant="bodyMedium" style={styles.emptyText}>
            {patientPharmacyText(PATIENT_PHARMACY_TEXT.empty.message)}
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  activeChip: {
    backgroundColor: "#d3f9d8",
  },
  card: {
    borderRadius: 12,
    marginBottom: 12,
  },
  cardHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  cardIcon: {
    backgroundColor: "#e6fcf5",
  },
  cardChips: {
    alignItems: "flex-end",
    gap: 6,
  },
  cardTitle: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  discontinuedChip: {
    backgroundColor: "#f1f3f5",
  },
  divider: {
    marginVertical: 12,
  },
  drugName: {
    fontWeight: "700",
  },
  emptyContainer: {
    alignItems: "center",
    flex: 1,
    gap: 8,
    justifyContent: "center",
    padding: 32,
  },
  emptyIcon: {
    backgroundColor: "#f1f3f5",
    marginBottom: 8,
  },
  emptyText: {
    opacity: 0.65,
    textAlign: "center",
  },
  filterContainer: {
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  handoffBanner: {
    alignItems: "center",
    borderRadius: 12,
    flexDirection: "row",
    gap: 12,
    margin: 16,
    marginBottom: 8,
    padding: 14,
  },
  handoffIcon: {
    backgroundColor: "#e6fcf5",
  },
  handoffText: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingTop: 0,
  },
  loadingContainer: {
    alignItems: "center",
    flex: 1,
    gap: 16,
    justifyContent: "center",
  },
  medicationInfo: {
    flex: 1,
  },
  medicationList: {
    gap: 10,
  },
  medicationRow: {
    alignItems: "flex-start",
    borderBottomColor: "#f1f3f5",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 10,
    paddingBottom: 10,
  },
  mutedText: {
    opacity: 0.65,
  },
  searchContainer: {
    padding: 16,
    paddingBottom: 8,
  },
  searchbar: {
    borderRadius: 12,
  },
  selectedCard: {
    borderColor: "#0ca678",
    borderWidth: 1,
  },
  selectedChip: {
    backgroundColor: "#d3f9d8",
  },
});
