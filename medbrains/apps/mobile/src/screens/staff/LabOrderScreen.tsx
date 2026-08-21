import { useHasPermission } from "@medbrains/stores";
import type { LabOrder, LabOrderStatus, LabPriority, LabTestCatalog } from "@medbrains/types";
import { P } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Avatar,
  Badge,
  Button,
  Card,
  Chip,
  Divider,
  IconButton,
  List,
  Searchbar,
  Snackbar,
  Surface,
  Text,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  MOBILE_LAB_ORDER_TEXT,
  mobilePatientJourneyText,
} from "../../components/patientJourneyText";
import { clinicalService } from "../../services/clinical.service";

interface LabOrderScreenProps {
  route: {
    params: {
      encounterId?: string;
      patientId?: string;
    };
  };
  navigation: {
    goBack: () => void;
  };
}

interface SelectedTest {
  id: string;
  name: string;
  code: string;
  category?: string;
  price?: number;
  tat_hours?: number;
}

interface CommonTest {
  categoryKey: string;
  code: string;
  id: string;
  nameKey: string;
}

const LAB_ORDER_TEXT = MOBILE_LAB_ORDER_TEXT;

const COMMON_TESTS: CommonTest[] = [
  {
    id: "cbc",
    nameKey: LAB_ORDER_TEXT.commonTests.cbc,
    code: "CBC",
    categoryKey: LAB_ORDER_TEXT.categories.hematology,
  },
  {
    id: "lft",
    nameKey: LAB_ORDER_TEXT.commonTests.lft,
    code: "LFT",
    categoryKey: LAB_ORDER_TEXT.categories.biochemistry,
  },
  {
    id: "rft",
    nameKey: LAB_ORDER_TEXT.commonTests.rft,
    code: "RFT",
    categoryKey: LAB_ORDER_TEXT.categories.biochemistry,
  },
  {
    id: "lipid",
    nameKey: LAB_ORDER_TEXT.commonTests.lipid,
    code: "LIPID",
    categoryKey: LAB_ORDER_TEXT.categories.biochemistry,
  },
  {
    id: "thyroid",
    nameKey: LAB_ORDER_TEXT.commonTests.thyroid,
    code: "TFT",
    categoryKey: LAB_ORDER_TEXT.categories.hormones,
  },
  {
    id: "hba1c",
    nameKey: LAB_ORDER_TEXT.commonTests.hba1c,
    code: "HBA1C",
    categoryKey: LAB_ORDER_TEXT.categories.diabetes,
  },
  {
    id: "urine",
    nameKey: LAB_ORDER_TEXT.commonTests.urine,
    code: "URINE",
    categoryKey: LAB_ORDER_TEXT.categories.clinicalPathology,
  },
  {
    id: "ecg",
    nameKey: LAB_ORDER_TEXT.commonTests.ecg,
    code: "ECG",
    categoryKey: LAB_ORDER_TEXT.categories.cardiology,
  },
];

const PRIORITY_OPTIONS: ReadonlyArray<{ value: LabPriority; labelKey: string }> = [
  { value: "routine", labelKey: LAB_ORDER_TEXT.priority.routine },
  { value: "urgent", labelKey: LAB_ORDER_TEXT.priority.urgent },
  { value: "stat", labelKey: LAB_ORDER_TEXT.priority.stat },
];

const LAB_STATUS_LABEL_KEYS: Record<LabOrderStatus, string> = {
  cancelled: LAB_ORDER_TEXT.status.cancelled,
  completed: LAB_ORDER_TEXT.status.completed,
  ordered: LAB_ORDER_TEXT.status.ordered,
  processing: LAB_ORDER_TEXT.status.processing,
  sample_collected: LAB_ORDER_TEXT.status.sampleCollected,
  verified: LAB_ORDER_TEXT.status.verified,
};

function labOrderText(key: string, values?: Record<string, string | number | boolean>): string {
  return mobilePatientJourneyText(key, values);
}

function selectedCommonTest(test: CommonTest): SelectedTest {
  return {
    id: test.id,
    name: labOrderText(test.nameKey),
    code: test.code,
    category: labOrderText(test.categoryKey),
  };
}

function labStatusText(status: LabOrderStatus): string {
  return labOrderText(LAB_STATUS_LABEL_KEYS[status]);
}

function placeLabOrderText(count: number): string {
  return labOrderText(
    count === 1 ? LAB_ORDER_TEXT.actions.placeSingular : LAB_ORDER_TEXT.actions.placePlural,
    { count },
  );
}

export function LabOrderScreen({ route, navigation }: LabOrderScreenProps) {
  const canOrderLabs = useHasPermission(P.LAB.ORDERS_CREATE);
  const theme = useTheme();
  const queryClient = useQueryClient();
  const { encounterId, patientId } = route.params;

  const [selectedTests, setSelectedTests] = useState<SelectedTest[]>([]);
  const [testSearch, setTestSearch] = useState("");
  const [priority, setPriority] = useState<LabPriority>("routine");
  const [snackbar, setSnackbar] = useState({ visible: false, message: "" });

  const { data: labCatalog, isLoading: catalogLoading } = useQuery({
    queryKey: ["lab", "catalog", testSearch],
    queryFn: () =>
      clinicalService.listLabCatalog({ search: testSearch, page: "1", per_page: "20" }),
    enabled: testSearch.length >= 2,
  });

  const { data: existingOrders, isLoading: ordersLoading } = useQuery({
    queryKey: ["lab", "orders", patientId],
    queryFn: () =>
      clinicalService.listLabOrders({ patient_id: patientId || "", page: "1", per_page: "5" }),
    enabled: Boolean(patientId),
  });

  const createOrderMutation = useMutation({
    mutationFn: async () => {
      if (!patientId || selectedTests.length === 0) {
        throw new Error(labOrderText(LAB_ORDER_TEXT.errors.noTestsSelected));
      }

      // Create orders for each selected test
      for (const test of selectedTests) {
        await clinicalService.createLabOrder({
          patient_id: patientId,
          encounter_id: encounterId,
          test_id: test.id,
          priority,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lab", "orders"] });
      setSnackbar({ visible: true, message: labOrderText(LAB_ORDER_TEXT.status.created) });
      setTimeout(() => navigation.goBack(), 1500);
    },
    onError: () => {
      setSnackbar({ visible: true, message: labOrderText(LAB_ORDER_TEXT.errors.failedToCreate) });
    },
  });

  const handleAddTest = (test: SelectedTest) => {
    if (!selectedTests.find((t) => t.id === test.id)) {
      setSelectedTests([...selectedTests, test]);
    }
    setTestSearch("");
  };

  const handleAddCommonTest = (test: CommonTest) => {
    handleAddTest(selectedCommonTest(test));
  };

  const handleAddFromCatalog = (test: LabTestCatalog) => {
    handleAddTest({
      id: test.id,
      name: test.name,
      code: test.code,
      // LabTestCatalog has department_id, not category
      category: test.sample_type || undefined,
      price: test.price ? parseFloat(test.price) : undefined,
      tat_hours: test.tat_hours || undefined,
    });
  };

  const handleRemoveTest = (testId: string) => {
    setSelectedTests(selectedTests.filter((t) => t.id !== testId));
  };

  const totalPrice = selectedTests.reduce((sum, t) => sum + (t.price || 0), 0);

  if (ordersLoading) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  const catalogList: LabTestCatalog[] = labCatalog || [];
  const ordersList: LabOrder[] = existingOrders?.orders || [];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Search Tests */}
        <Searchbar
          placeholder={labOrderText(LAB_ORDER_TEXT.search.placeholder)}
          value={testSearch}
          onChangeText={setTestSearch}
          style={styles.searchbar}
        />

        {/* Search Results */}
        {testSearch.length >= 2 && (
          <Surface style={styles.searchResults} elevation={2}>
            {catalogLoading ? (
              <ActivityIndicator style={styles.searchLoading} />
            ) : catalogList.length > 0 ? (
              catalogList.map((test) => (
                <List.Item
                  key={test.id}
                  title={test.name}
                  description={labOrderText(LAB_ORDER_TEXT.search.resultDescription, {
                    code: test.code,
                    sample: test.sample_type || labOrderText(LAB_ORDER_TEXT.categories.general),
                  })}
                  left={(props) => <List.Icon {...props} icon="flask" />}
                  right={() => (
                    <IconButton
                      accessibilityLabel={labOrderText(LAB_ORDER_TEXT.actions.addTest)}
                      icon={selectedTests.find((t) => t.id === test.id) ? "check" : "plus"}
                      onPress={() => handleAddFromCatalog(test)}
                    />
                  )}
                  onPress={() => handleAddFromCatalog(test)}
                />
              ))
            ) : (
              <Text style={styles.noResults}>{labOrderText(LAB_ORDER_TEXT.empty.noResults)}</Text>
            )}
          </Surface>
        )}

        {/* Quick Add - Common Tests */}
        <Text variant="titleMedium" style={styles.sectionTitle}>
          {labOrderText(LAB_ORDER_TEXT.sections.commonTests)}
        </Text>
        <View style={styles.commonTests}>
          {COMMON_TESTS.map((test) => (
            <Chip
              key={test.id}
              onPress={() => handleAddCommonTest(test)}
              selected={selectedTests.some((t) => t.id === test.id)}
              style={styles.commonChip}
              icon={selectedTests.some((t) => t.id === test.id) ? "check" : "plus"}
            >
              {labOrderText(test.nameKey)}
            </Chip>
          ))}
        </View>

        {/* Priority Selection */}
        <Text variant="titleMedium" style={styles.sectionTitle}>
          {labOrderText(LAB_ORDER_TEXT.sections.priority)}
        </Text>
        <View style={styles.priorityRow}>
          {PRIORITY_OPTIONS.map((option) => (
            <Chip
              key={option.value}
              selected={priority === option.value}
              onPress={() => setPriority(option.value)}
              style={[
                styles.priorityChip,
                priority === "urgent" && option.value === "urgent" && styles.urgentChip,
                priority === "stat" && option.value === "stat" && styles.statChip,
              ]}
            >
              {labOrderText(option.labelKey)}
            </Chip>
          ))}
        </View>

        {/* Selected Tests */}
        <View style={styles.selectedHeader}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            {labOrderText(LAB_ORDER_TEXT.sections.selectedTests)}
          </Text>
          {selectedTests.length > 0 && <Badge size={24}>{selectedTests.length}</Badge>}
        </View>

        {selectedTests.length > 0 ? (
          <>
            {selectedTests.map((test) => (
              <Surface key={test.id} style={styles.testCard} elevation={1}>
                <View style={styles.testInfo}>
                  <Text variant="titleSmall" style={styles.testName}>
                    {test.name}
                  </Text>
                  <View style={styles.testMeta}>
                    <Chip compact>{test.code}</Chip>
                    {test.category && <Chip compact>{test.category}</Chip>}
                    {test.tat_hours && (
                      <Chip compact icon="clock">
                        {labOrderText(LAB_ORDER_TEXT.tests.tatHours, { hours: test.tat_hours })}
                      </Chip>
                    )}
                  </View>
                </View>
                {test.price !== undefined && test.price > 0 && (
                  <Text variant="labelLarge" style={styles.testPrice}>
                    ₹{test.price}
                  </Text>
                )}
                <IconButton icon="close" size={20} onPress={() => handleRemoveTest(test.id)} />
              </Surface>
            ))}

            {/* Total */}
            {totalPrice > 0 && (
              <Surface style={styles.totalCard} elevation={1}>
                <Text variant="titleMedium">{labOrderText(LAB_ORDER_TEXT.tests.total)}</Text>
                <Text variant="headlineSmall" style={styles.totalAmount}>
                  ₹{totalPrice}
                </Text>
              </Surface>
            )}
          </>
        ) : (
          <Surface style={styles.emptyState} elevation={1}>
            <Avatar.Icon size={48} icon="flask-outline" style={styles.emptyIcon} />
            <Text variant="bodyMedium" style={styles.emptyText}>
              {labOrderText(LAB_ORDER_TEXT.empty.title)}
            </Text>
            <Text variant="bodySmall" style={styles.emptyHint}>
              {labOrderText(LAB_ORDER_TEXT.empty.hint)}
            </Text>
          </Surface>
        )}

        {/* Previous Orders */}
        {ordersList.length > 0 && (
          <Card style={styles.previousCard}>
            <Card.Content>
              <Text variant="titleSmall" style={styles.previousTitle}>
                {labOrderText(LAB_ORDER_TEXT.recent.title)}
              </Text>
              <Divider style={styles.divider} />
              {ordersList.slice(0, 3).map((order) => (
                <List.Item
                  key={order.id}
                  title={labOrderText(LAB_ORDER_TEXT.recent.orderTitle)}
                  description={labOrderText(LAB_ORDER_TEXT.recent.description, {
                    status: labStatusText(order.status),
                    date: new Date(order.created_at).toLocaleDateString(),
                  })}
                  left={(props) => <List.Icon {...props} icon="flask" />}
                  right={() => (
                    <Chip
                      compact
                      style={order.status === "completed" ? styles.completedChip : undefined}
                    >
                      {labStatusText(order.status)}
                    </Chip>
                  )}
                />
              ))}
            </Card.Content>
          </Card>
        )}

        {/* Submit Button */}
        {selectedTests.length > 0 && (
          <Button
            mode="contained"
            onPress={() => createOrderMutation.mutate()}
            loading={createOrderMutation.isPending}
            disabled={createOrderMutation.isPending || !canOrderLabs}
            style={styles.submitButton}
            contentStyle={styles.submitButtonContent}
            icon="flask-plus"
          >
            {placeLabOrderText(selectedTests.length)}
          </Button>
        )}
      </ScrollView>

      <Snackbar
        visible={snackbar.visible}
        onDismiss={() => setSnackbar({ ...snackbar, visible: false })}
        duration={3000}
      >
        {snackbar.message}
      </Snackbar>
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
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  searchbar: {
    borderRadius: 12,
    marginBottom: 16,
  },
  searchResults: {
    borderRadius: 12,
    marginBottom: 16,
    maxHeight: 200,
  },
  searchLoading: {
    padding: 16,
  },
  noResults: {
    padding: 16,
    textAlign: "center",
    opacity: 0.6,
  },
  sectionTitle: {
    fontWeight: "600",
    marginBottom: 12,
  },
  commonTests: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 24,
  },
  commonChip: {
    marginBottom: 4,
  },
  priorityRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  priorityChip: {
    flex: 1,
  },
  urgentChip: {
    backgroundColor: "#fff3bf",
  },
  statChip: {
    backgroundColor: "#ffe3e3",
  },
  selectedHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  testCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  testInfo: {
    flex: 1,
  },
  testName: {
    fontWeight: "600",
  },
  testMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
  },
  testPrice: {
    color: "#0F766E",
    marginRight: 8,
  },
  totalCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
    backgroundColor: "#e7f5ff",
  },
  totalAmount: {
    fontWeight: "bold",
    color: "#0F766E",
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
  },
  previousCard: {
    marginTop: 24,
    borderRadius: 12,
    backgroundColor: "#f8f9fa",
  },
  previousTitle: {
    fontWeight: "600",
    opacity: 0.7,
  },
  divider: {
    marginVertical: 8,
  },
  completedChip: {
    backgroundColor: "#d3f9d8",
  },
  submitButton: {
    marginTop: 24,
    borderRadius: 12,
  },
  submitButtonContent: {
    paddingVertical: 8,
  },
});
