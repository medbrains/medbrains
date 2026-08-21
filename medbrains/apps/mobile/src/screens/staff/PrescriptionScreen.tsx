import { zodResolver } from "@hookform/resolvers/zod";
import {
  type MobilePrescriptionItemFormInput,
  mobilePrescriptionItemFormSchema,
} from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type { PharmacyCatalog, PrescriptionWithItems } from "@medbrains/types";
import { P } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import {
  ActivityIndicator,
  Avatar,
  Button,
  Card,
  Chip,
  Dialog,
  Divider,
  FAB,
  HelperText,
  IconButton,
  List,
  Portal,
  Searchbar,
  Snackbar,
  Surface,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  MOBILE_PRESCRIPTION_TEXT,
  mobilePatientJourneyText,
} from "../../components/patientJourneyText";
import { clinicalService } from "../../services/clinical.service";

interface PrescriptionScreenProps {
  route: {
    params: {
      encounterId?: string;
    };
  };
  navigation: {
    goBack: () => void;
  };
}

type PrescriptionItem = MobilePrescriptionItemFormInput & { id: string };
type PrescriptionOption = {
  labelKey: string;
  value: string;
};

const PRESCRIPTION_TEXT = MOBILE_PRESCRIPTION_TEXT;
const DEFAULT_FREQUENCY = "Once daily";
const DEFAULT_DURATION = "7 days";
const DEFAULT_ROUTE = "Oral";

const FREQUENCY_OPTIONS: readonly PrescriptionOption[] = [
  { value: DEFAULT_FREQUENCY, labelKey: PRESCRIPTION_TEXT.frequencies.onceDaily },
  { value: "Twice daily", labelKey: PRESCRIPTION_TEXT.frequencies.twiceDaily },
  { value: "Three times daily", labelKey: PRESCRIPTION_TEXT.frequencies.threeTimesDaily },
  { value: "Four times daily", labelKey: PRESCRIPTION_TEXT.frequencies.fourTimesDaily },
  { value: "As needed", labelKey: PRESCRIPTION_TEXT.frequencies.asNeeded },
  { value: "Before meals", labelKey: PRESCRIPTION_TEXT.frequencies.beforeMeals },
  { value: "After meals", labelKey: PRESCRIPTION_TEXT.frequencies.afterMeals },
  { value: "At bedtime", labelKey: PRESCRIPTION_TEXT.frequencies.atBedtime },
];
const ROUTE_OPTIONS: readonly PrescriptionOption[] = [
  { value: DEFAULT_ROUTE, labelKey: PRESCRIPTION_TEXT.routes.oral },
  { value: "Topical", labelKey: PRESCRIPTION_TEXT.routes.topical },
  { value: "IV", labelKey: PRESCRIPTION_TEXT.routes.iv },
  { value: "IM", labelKey: PRESCRIPTION_TEXT.routes.im },
  { value: "SC", labelKey: PRESCRIPTION_TEXT.routes.sc },
  { value: "Inhalation", labelKey: PRESCRIPTION_TEXT.routes.inhalation },
  { value: "Sublingual", labelKey: PRESCRIPTION_TEXT.routes.sublingual },
  { value: "Rectal", labelKey: PRESCRIPTION_TEXT.routes.rectal },
];
const DURATION_OPTIONS: readonly PrescriptionOption[] = [
  { value: "3 days", labelKey: PRESCRIPTION_TEXT.durations.threeDays },
  { value: "5 days", labelKey: PRESCRIPTION_TEXT.durations.fiveDays },
  { value: DEFAULT_DURATION, labelKey: PRESCRIPTION_TEXT.durations.sevenDays },
  { value: "10 days", labelKey: PRESCRIPTION_TEXT.durations.tenDays },
  { value: "14 days", labelKey: PRESCRIPTION_TEXT.durations.fourteenDays },
  { value: "1 month", labelKey: PRESCRIPTION_TEXT.durations.oneMonth },
  { value: "3 months", labelKey: PRESCRIPTION_TEXT.durations.threeMonths },
  { value: "Continuous", labelKey: PRESCRIPTION_TEXT.durations.continuous },
];

const defaultPrescriptionItemFormValues: MobilePrescriptionItemFormInput = {
  drug_name: "",
  generic_name: "",
  dosage: "",
  frequency: DEFAULT_FREQUENCY,
  duration: DEFAULT_DURATION,
  route: DEFAULT_ROUTE,
  instructions: "",
};

function prescriptionText(key: string, values?: Record<string, string | number | boolean>): string {
  return mobilePatientJourneyText(key, values);
}

function optionLabel(options: readonly PrescriptionOption[], value: string): string {
  const option = options.find((candidate) => candidate.value === value);
  return option ? prescriptionText(option.labelKey) : value;
}

function fieldErrorText(message: string | undefined): string | undefined {
  return message ? prescriptionText(message) : undefined;
}

function itemCountText(count: number): string {
  return prescriptionText(
    count === 1
      ? PRESCRIPTION_TEXT.summary.itemCountSingular
      : PRESCRIPTION_TEXT.summary.itemCountPlural,
    { count },
  );
}

function saveButtonText(count: number): string {
  return prescriptionText(
    count === 1 ? PRESCRIPTION_TEXT.actions.saveSingular : PRESCRIPTION_TEXT.actions.savePlural,
    { count },
  );
}

export function PrescriptionScreen({ route, navigation }: PrescriptionScreenProps) {
  const canPrescribe = useHasPermission(P.OPD.VISIT_UPDATE);
  const theme = useTheme();
  const queryClient = useQueryClient();
  const { encounterId } = route.params;

  const [items, setItems] = useState<PrescriptionItem[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [drugSearch, setDrugSearch] = useState("");
  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<MobilePrescriptionItemFormInput>({
    resolver: zodResolver(mobilePrescriptionItemFormSchema),
    mode: "onChange",
    defaultValues: defaultPrescriptionItemFormValues,
  });
  const currentItem = watch();
  const [snackbar, setSnackbar] = useState({ visible: false, message: "" });

  const { data: existingPrescriptions, isLoading } = useQuery({
    queryKey: ["prescriptions", encounterId],
    queryFn: () => clinicalService.listPrescriptions(encounterId || ""),
    enabled: Boolean(encounterId),
  });

  const { data: drugCatalog } = useQuery({
    queryKey: ["pharmacy", "catalog", drugSearch],
    queryFn: () =>
      clinicalService.listPharmacyCatalog({ search: drugSearch, page: "1", per_page: "10" }),
    enabled: drugSearch.length >= 2,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!encounterId || items.length === 0) {
        throw new Error(prescriptionText(PRESCRIPTION_TEXT.errors.noItems));
      }

      await clinicalService.createPrescription(encounterId, {
        items: items.map((item) => ({
          drug_name: item.drug_name,
          dosage: item.dosage,
          frequency: item.frequency,
          duration: item.duration,
          route: item.route,
          instructions: item.instructions,
        })),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prescriptions"] });
      setSnackbar({ visible: true, message: prescriptionText(PRESCRIPTION_TEXT.status.saved) });
      setTimeout(() => navigation.goBack(), 1500);
    },
    onError: () => {
      setSnackbar({
        visible: true,
        message: prescriptionText(PRESCRIPTION_TEXT.errors.failedToSave),
      });
    },
  });

  const handleAddItem = handleSubmit((item) => {
    setItems([...items, { ...item, id: Date.now().toString() }]);
    reset(defaultPrescriptionItemFormValues);
    setDrugSearch("");
    setShowAddDialog(false);
  });

  const handleRemoveItem = (id: string) => {
    setItems(items.filter((item) => item.id !== id));
  };

  const handleSelectDrug = (drug: PharmacyCatalog) => {
    setValue("drug_name", drug.name, { shouldDirty: true, shouldValidate: true });
    setValue("generic_name", drug.generic_name || "", { shouldDirty: true, shouldValidate: true });
    setDrugSearch("");
  };

  const handleCopyFromPrevious = (rx: PrescriptionWithItems) => {
    // Add items from the previous prescription
    const newItems = rx.items.map((item) => ({
      id: Date.now().toString() + Math.random().toString(),
      drug_name: item.drug_name,
      dosage: item.dosage,
      frequency: item.frequency,
      duration: item.duration,
      route: item.route || DEFAULT_ROUTE,
      instructions: item.instructions || undefined,
    }));
    setItems([...items, ...newItems]);
    setSnackbar({
      visible: true,
      message: prescriptionText(PRESCRIPTION_TEXT.status.copiedPrevious),
    });
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  const drugList: PharmacyCatalog[] = drugCatalog || [];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Previous Prescriptions */}
        {existingPrescriptions && existingPrescriptions.length > 0 && (
          <Card style={styles.previousCard}>
            <Card.Content>
              <Text variant="titleSmall" style={styles.previousTitle}>
                {prescriptionText(PRESCRIPTION_TEXT.sections.previous)}
              </Text>
              <Divider style={styles.divider} />
              {existingPrescriptions.slice(0, 3).map((rx) => (
                <List.Item
                  key={rx.prescription.id}
                  title={itemCountText(rx.items.length)}
                  description={new Date(rx.prescription.created_at).toLocaleDateString()}
                  left={(props) => <List.Icon {...props} icon="pill" />}
                  right={() => (
                    <IconButton
                      accessibilityLabel={prescriptionText(PRESCRIPTION_TEXT.actions.copyPrevious)}
                      icon="content-copy"
                      size={20}
                      onPress={() => handleCopyFromPrevious(rx)}
                    />
                  )}
                />
              ))}
            </Card.Content>
          </Card>
        )}

        {/* Current Prescription Items */}
        <Text variant="titleMedium" style={styles.sectionTitle}>
          {prescriptionText(PRESCRIPTION_TEXT.sections.current)}
        </Text>

        {items.length > 0 ? (
          items.map((item, index) => (
            <Surface key={item.id} style={styles.itemCard} elevation={1}>
              <View style={styles.itemHeader}>
                <View style={styles.itemNumber}>
                  <Text style={styles.itemNumberText}>{index + 1}</Text>
                </View>
                <View style={styles.itemInfo}>
                  <Text variant="titleSmall" style={styles.drugName}>
                    {item.drug_name}
                  </Text>
                  {item.generic_name && (
                    <Text variant="bodySmall" style={styles.genericName}>
                      ({item.generic_name})
                    </Text>
                  )}
                </View>
                <IconButton icon="close" size={20} onPress={() => handleRemoveItem(item.id)} />
              </View>
              <View style={styles.itemDetails}>
                <Chip compact icon="pill">
                  {item.dosage}
                </Chip>
                <Chip compact icon="clock">
                  {optionLabel(FREQUENCY_OPTIONS, item.frequency)}
                </Chip>
                <Chip compact icon="calendar">
                  {optionLabel(DURATION_OPTIONS, item.duration)}
                </Chip>
                <Chip compact icon="routes">
                  {optionLabel(ROUTE_OPTIONS, item.route)}
                </Chip>
              </View>
              {item.instructions && (
                <Text variant="bodySmall" style={styles.instructions}>
                  {prescriptionText(PRESCRIPTION_TEXT.summary.note, {
                    instructions: item.instructions,
                  })}
                </Text>
              )}
            </Surface>
          ))
        ) : (
          <Surface style={styles.emptyState} elevation={1}>
            <Avatar.Icon size={48} icon="pill" style={styles.emptyIcon} />
            <Text variant="bodyMedium" style={styles.emptyText}>
              {prescriptionText(PRESCRIPTION_TEXT.empty.title)}
            </Text>
            <Text variant="bodySmall" style={styles.emptyHint}>
              {prescriptionText(PRESCRIPTION_TEXT.empty.hint)}
            </Text>
          </Surface>
        )}

        {/* Save Button */}
        {items.length > 0 && (
          <Button
            mode="contained"
            onPress={() => saveMutation.mutate()}
            loading={saveMutation.isPending}
            disabled={saveMutation.isPending || !canPrescribe}
            style={styles.saveButton}
            contentStyle={styles.saveButtonContent}
            icon="content-save"
          >
            {saveButtonText(items.length)}
          </Button>
        )}
      </ScrollView>

      {/* Add FAB */}
      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => setShowAddDialog(true)}
        label={prescriptionText(PRESCRIPTION_TEXT.actions.addDrug)}
      />

      {/* Add Drug Dialog */}
      <Portal>
        <Dialog visible={showAddDialog} onDismiss={() => setShowAddDialog(false)}>
          <Dialog.Title>{prescriptionText(PRESCRIPTION_TEXT.dialog.addMedication)}</Dialog.Title>
          <Dialog.ScrollArea style={styles.dialogScroll}>
            <ScrollView>
              {/* Drug Search */}
              <Searchbar
                placeholder={prescriptionText(PRESCRIPTION_TEXT.dialog.searchPlaceholder)}
                value={drugSearch}
                onChangeText={setDrugSearch}
                style={styles.drugSearch}
              />

              {drugList.length > 0 && (
                <View style={styles.drugResults}>
                  {drugList.map((drug) => (
                    <TouchableOpacity key={drug.id} onPress={() => handleSelectDrug(drug)}>
                      <List.Item
                        title={drug.name}
                        description={drug.generic_name || undefined}
                        left={(props) => <List.Icon {...props} icon="pill" />}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {currentItem.drug_name && (
                <Chip style={styles.selectedDrug} icon="check">
                  {currentItem.drug_name}
                </Chip>
              )}

              <Controller
                control={control}
                name="drug_name"
                render={({ field }) => {
                  const drugNameError = fieldErrorText(errors.drug_name?.message);
                  return (
                    <>
                      <TextInput
                        label={prescriptionText(PRESCRIPTION_TEXT.dialog.drugName)}
                        value={field.value}
                        onChangeText={field.onChange}
                        mode="outlined"
                        error={Boolean(drugNameError)}
                        style={styles.dialogInput}
                      />
                      <HelperText type="error" visible={Boolean(drugNameError)}>
                        {drugNameError ?? ""}
                      </HelperText>
                    </>
                  );
                }}
              />

              <Controller
                control={control}
                name="dosage"
                render={({ field }) => {
                  const dosageError = fieldErrorText(errors.dosage?.message);
                  return (
                    <>
                      <TextInput
                        label={prescriptionText(PRESCRIPTION_TEXT.dialog.dosage)}
                        value={field.value}
                        onChangeText={field.onChange}
                        mode="outlined"
                        error={Boolean(dosageError)}
                        style={styles.dialogInput}
                      />
                      <HelperText type="error" visible={Boolean(dosageError)}>
                        {dosageError ?? ""}
                      </HelperText>
                    </>
                  );
                }}
              />

              <Text variant="labelMedium" style={styles.dialogLabel}>
                {prescriptionText(PRESCRIPTION_TEXT.dialog.frequency)}
              </Text>
              <View style={styles.chipGroup}>
                {FREQUENCY_OPTIONS.slice(0, 4).map((option) => (
                  <Chip
                    key={option.value}
                    selected={currentItem.frequency === option.value}
                    onPress={() =>
                      setValue("frequency", option.value, {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                    style={styles.selectChip}
                  >
                    {prescriptionText(option.labelKey)}
                  </Chip>
                ))}
              </View>

              <Text variant="labelMedium" style={styles.dialogLabel}>
                {prescriptionText(PRESCRIPTION_TEXT.dialog.duration)}
              </Text>
              <View style={styles.chipGroup}>
                {DURATION_OPTIONS.slice(0, 4).map((option) => (
                  <Chip
                    key={option.value}
                    selected={currentItem.duration === option.value}
                    onPress={() =>
                      setValue("duration", option.value, {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                    style={styles.selectChip}
                  >
                    {prescriptionText(option.labelKey)}
                  </Chip>
                ))}
              </View>

              <Text variant="labelMedium" style={styles.dialogLabel}>
                {prescriptionText(PRESCRIPTION_TEXT.dialog.route)}
              </Text>
              <View style={styles.chipGroup}>
                {ROUTE_OPTIONS.slice(0, 4).map((option) => (
                  <Chip
                    key={option.value}
                    selected={currentItem.route === option.value}
                    onPress={() =>
                      setValue("route", option.value, { shouldDirty: true, shouldValidate: true })
                    }
                    style={styles.selectChip}
                  >
                    {prescriptionText(option.labelKey)}
                  </Chip>
                ))}
              </View>

              <Controller
                control={control}
                name="instructions"
                render={({ field }) => (
                  <TextInput
                    label={prescriptionText(PRESCRIPTION_TEXT.dialog.instructions)}
                    value={field.value || ""}
                    onChangeText={field.onChange}
                    mode="outlined"
                    multiline
                    style={styles.dialogInput}
                  />
                )}
              />
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setShowAddDialog(false)}>
              {prescriptionText(PRESCRIPTION_TEXT.actions.cancel)}
            </Button>
            <Button
              mode="contained"
              onPress={() => void handleAddItem()}
              disabled={!currentItem.drug_name.trim() || !currentItem.dosage.trim()}
            >
              {prescriptionText(PRESCRIPTION_TEXT.actions.add)}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

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
    paddingBottom: 100,
  },
  previousCard: {
    marginBottom: 24,
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
  sectionTitle: {
    fontWeight: "600",
    marginBottom: 12,
  },
  itemCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  itemHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  itemNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#0F766E",
    justifyContent: "center",
    alignItems: "center",
  },
  itemNumberText: {
    color: "#fff",
    fontWeight: "bold",
  },
  itemInfo: {
    flex: 1,
  },
  drugName: {
    fontWeight: "600",
  },
  genericName: {
    opacity: 0.6,
  },
  itemDetails: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  instructions: {
    marginTop: 8,
    fontStyle: "italic",
    opacity: 0.7,
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
  saveButton: {
    marginTop: 16,
    borderRadius: 12,
  },
  saveButtonContent: {
    paddingVertical: 8,
  },
  fab: {
    position: "absolute",
    right: 16,
    bottom: 16,
  },
  dialogScroll: {
    maxHeight: 400,
  },
  drugSearch: {
    marginBottom: 12,
  },
  drugResults: {
    backgroundColor: "#f8f9fa",
    borderRadius: 8,
    marginBottom: 12,
  },
  selectedDrug: {
    marginBottom: 12,
    backgroundColor: "#d3f9d8",
  },
  dialogInput: {
    marginBottom: 12,
  },
  dialogLabel: {
    marginBottom: 8,
    opacity: 0.7,
  },
  chipGroup: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  selectChip: {
    marginBottom: 4,
  },
});
