import { zodResolver } from "@hookform/resolvers/zod";
import type { RadiologyOrderFormInput } from "@medbrains/schemas";
import { radiologyOrderFormSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type { RadiologyModality, RadiologyOrder, RadiologyPriority } from "@medbrains/types";
import { P } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Avatar,
  Button,
  Card,
  Chip,
  Divider,
  List,
  Snackbar,
  Surface,
  Switch,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { clinicalService } from "../../services/clinical.service";

interface RadiologyOrderScreenProps {
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

const PRIORITY_OPTIONS: ReadonlyArray<{
  icon: string;
  label: string;
  value: RadiologyPriority;
}> = [
  { value: "routine", label: "Routine", icon: "calendar-clock" },
  { value: "urgent", label: "Urgent", icon: "alert-circle-outline" },
  { value: "stat", label: "STAT", icon: "alert-decagram" },
];

function radiologyOrderDefaults(patientId?: string): RadiologyOrderFormInput {
  return {
    patient_id: patientId ?? "",
    modality_id: "",
    body_part: "",
    clinical_indication: "",
    priority: "routine",
    contrast_required: false,
    pregnancy_checked: false,
    allergy_flagged: false,
    notes: "",
  };
}

function optionalText(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function modalityLabel(modality: RadiologyModality) {
  return `${modality.code} - ${modality.name}`;
}

export function RadiologyOrderScreen({ route, navigation }: RadiologyOrderScreenProps) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const { encounterId, patientId } = route.params;
  const canCreateRadiologyOrder = useHasPermission(P.RADIOLOGY.ORDERS_CREATE);
  const canListRadiologyOrders = useHasPermission(P.RADIOLOGY.ORDERS_LIST);

  const defaultValues = radiologyOrderDefaults(patientId);
  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<RadiologyOrderFormInput>({
    resolver: zodResolver(radiologyOrderFormSchema),
    defaultValues,
  });
  const selectedModalityId = watch("modality_id");

  const [snackbar, setSnackbar] = useState({ visible: false, message: "" });

  const { data: modalities, isLoading: modalitiesLoading } = useQuery({
    queryKey: ["radiology", "modalities"],
    queryFn: () => clinicalService.listRadiologyModalities(),
    enabled: canListRadiologyOrders,
  });

  const { data: recentOrders, isLoading: ordersLoading } = useQuery({
    queryKey: ["radiology", "orders", patientId],
    queryFn: () =>
      clinicalService.listRadiologyOrders({
        patient_id: patientId ?? "",
        page: "1",
        per_page: "5",
      }),
    enabled: canListRadiologyOrders && Boolean(patientId),
  });

  const createOrderMutation = useMutation({
    mutationFn: (values: RadiologyOrderFormInput) =>
      clinicalService.createRadiologyOrder({
        patient_id: values.patient_id.trim(),
        encounter_id: optionalText(encounterId ?? ""),
        modality_id: values.modality_id.trim(),
        body_part: optionalText(values.body_part),
        clinical_indication: optionalText(values.clinical_indication),
        priority: values.priority,
        contrast_required: values.contrast_required,
        pregnancy_checked: values.pregnancy_checked,
        allergy_flagged: values.allergy_flagged,
        notes: optionalText(values.notes),
      }),
    onSuccess: (order) => {
      void queryClient.invalidateQueries({ queryKey: ["radiology", "orders"] });
      void queryClient.invalidateQueries({ queryKey: ["radiology-orders"] });
      setSnackbar({
        visible: true,
        message: `Imaging order ${order.id.slice(0, 8)} created`,
      });
      reset(defaultValues);
      setTimeout(() => navigation.goBack(), 1200);
    },
    onError: () => {
      setSnackbar({ visible: true, message: "Failed to create imaging order" });
    },
  });

  const activeModalities = (modalities ?? []).filter((modality) => modality.is_active);
  const selectedModality = activeModalities.find((modality) => modality.id === selectedModalityId);
  const orderList: RadiologyOrder[] = recentOrders?.orders ?? [];
  const submitDisabled =
    !canCreateRadiologyOrder ||
    !canListRadiologyOrders ||
    modalitiesLoading ||
    activeModalities.length === 0 ||
    createOrderMutation.isPending;

  const handleCreateOrder = handleSubmit((values) => createOrderMutation.mutate(values));

  if (modalitiesLoading || ordersLoading) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Surface style={styles.contextCard} elevation={1}>
          <View style={styles.contextHeader}>
            <Avatar.Icon size={42} icon="radioactive" style={styles.contextIcon} />
            <View style={styles.contextText}>
              <Text variant="titleMedium" style={styles.cardTitle}>
                Imaging order
              </Text>
              <Text variant="bodySmall" style={styles.mutedText}>
                Radiology handoff linked to the active OPD or IPD encounter.
              </Text>
            </View>
          </View>
          <View style={styles.metaRow}>
            <Chip compact icon="account">
              {patientId ? "Patient linked" : "Patient required"}
            </Chip>
            <Chip compact icon="stethoscope">
              {encounterId ? "Encounter linked" : "No encounter"}
            </Chip>
          </View>
        </Surface>

        {(!canCreateRadiologyOrder || !canListRadiologyOrders) && (
          <Card style={styles.restrictedCard}>
            <Card.Content>
              <Text variant="titleSmall" style={styles.cardTitle}>
                Radiology order access restricted
              </Text>
              <Text variant="bodySmall" style={styles.mutedText}>
                Creating mobile imaging orders requires radiology order create permission and
                modality list access.
              </Text>
            </Card.Content>
          </Card>
        )}

        <Card style={styles.formCard}>
          <Card.Content>
            <Text variant="titleSmall" style={styles.cardTitle}>
              Patient and modality
            </Text>
            <Controller
              control={control}
              name="patient_id"
              render={({ field }) => (
                <TextInput
                  mode="outlined"
                  label="Patient ID"
                  value={field.value}
                  onChangeText={field.onChange}
                  disabled={Boolean(patientId)}
                  error={Boolean(errors.patient_id)}
                  style={styles.input}
                />
              )}
            />
            {errors.patient_id?.message && (
              <Text variant="labelSmall" style={styles.errorText}>
                {errors.patient_id.message}
              </Text>
            )}

            <Controller
              control={control}
              name="modality_id"
              render={({ field, fieldState }) => (
                <View>
                  <Text variant="labelLarge" style={styles.fieldLabel}>
                    Modality
                  </Text>
                  {activeModalities.length === 0 ? (
                    <Surface style={styles.emptyState} elevation={1}>
                      <Text variant="bodyMedium" style={styles.mutedText}>
                        No active radiology modalities are available.
                      </Text>
                    </Surface>
                  ) : (
                    <View style={styles.modalityGrid}>
                      {activeModalities.map((modality) => (
                        <Chip
                          key={modality.id}
                          selected={field.value === modality.id}
                          icon={field.value === modality.id ? "check" : "radioactive"}
                          onPress={() => field.onChange(modality.id)}
                          style={styles.modalityChip}
                        >
                          {modalityLabel(modality)}
                        </Chip>
                      ))}
                    </View>
                  )}
                  {fieldState.error?.message && (
                    <Text variant="labelSmall" style={styles.errorText}>
                      {fieldState.error.message}
                    </Text>
                  )}
                </View>
              )}
            />

            {selectedModality && (
              <Surface style={styles.selectedModalityCard} elevation={0}>
                <Text variant="labelMedium" style={styles.cardTitle}>
                  Selected: {modalityLabel(selectedModality)}
                </Text>
                {selectedModality.description && (
                  <Text variant="bodySmall" style={styles.mutedText}>
                    {selectedModality.description}
                  </Text>
                )}
              </Surface>
            )}
          </Card.Content>
        </Card>

        <Card style={styles.formCard}>
          <Card.Content>
            <Text variant="titleSmall" style={styles.cardTitle}>
              Clinical details
            </Text>
            <Controller
              control={control}
              name="body_part"
              render={({ field }) => (
                <TextInput
                  mode="outlined"
                  label="Body part"
                  value={field.value}
                  onChangeText={field.onChange}
                  placeholder="e.g. Chest, abdomen, left knee"
                  style={styles.input}
                />
              )}
            />
            <Controller
              control={control}
              name="clinical_indication"
              render={({ field }) => (
                <TextInput
                  mode="outlined"
                  label="Clinical indication"
                  value={field.value}
                  onChangeText={field.onChange}
                  multiline
                  numberOfLines={3}
                  placeholder="Reason for imaging"
                  style={styles.input}
                />
              )}
            />
            <Controller
              control={control}
              name="notes"
              render={({ field }) => (
                <TextInput
                  mode="outlined"
                  label="Notes"
                  value={field.value}
                  onChangeText={field.onChange}
                  multiline
                  numberOfLines={3}
                  placeholder="Preparation, transport or scheduling notes"
                  style={styles.input}
                />
              )}
            />
          </Card.Content>
        </Card>

        <Card style={styles.formCard}>
          <Card.Content>
            <Text variant="titleSmall" style={styles.cardTitle}>
              Priority and safety
            </Text>
            <Controller
              control={control}
              name="priority"
              render={({ field }) => (
                <View style={styles.priorityRow}>
                  {PRIORITY_OPTIONS.map((option) => (
                    <Chip
                      key={option.value}
                      selected={field.value === option.value}
                      icon={option.icon}
                      onPress={() => field.onChange(option.value)}
                      style={styles.priorityChip}
                    >
                      {option.label}
                    </Chip>
                  ))}
                </View>
              )}
            />

            <Divider style={styles.divider} />

            <Controller
              control={control}
              name="contrast_required"
              render={({ field }) => (
                <List.Item
                  title="Contrast required"
                  description="Mark before sending patient to contrast workflow"
                  left={(props) => <List.Icon {...props} icon="water-plus" />}
                  right={() => <Switch value={field.value} onValueChange={field.onChange} />}
                />
              )}
            />
            <Controller
              control={control}
              name="pregnancy_checked"
              render={({ field }) => (
                <List.Item
                  title="Pregnancy status checked"
                  description="Required safety check where applicable"
                  left={(props) => <List.Icon {...props} icon="shield-check" />}
                  right={() => <Switch value={field.value} onValueChange={field.onChange} />}
                />
              )}
            />
            <Controller
              control={control}
              name="allergy_flagged"
              render={({ field }) => (
                <List.Item
                  title="Allergy or contrast risk flagged"
                  description="Highlights allergy or renal/contrast risk for radiology"
                  left={(props) => <List.Icon {...props} icon="alert" />}
                  right={() => <Switch value={field.value} onValueChange={field.onChange} />}
                />
              )}
            />
          </Card.Content>
        </Card>

        {orderList.length > 0 && (
          <Card style={styles.previousCard}>
            <Card.Content>
              <Text variant="titleSmall" style={styles.cardTitle}>
                Recent imaging orders
              </Text>
              <Divider style={styles.divider} />
              {orderList.slice(0, 3).map((order) => (
                <List.Item
                  key={order.id}
                  title={order.body_part || "Radiology order"}
                  description={`${order.status} - ${new Date(order.created_at).toLocaleDateString()}`}
                  left={(props) => <List.Icon {...props} icon="radioactive" />}
                  right={() => (
                    <Chip compact style={order.status === "verified" ? styles.completedChip : null}>
                      {order.priority}
                    </Chip>
                  )}
                />
              ))}
            </Card.Content>
          </Card>
        )}

        <Button
          mode="contained"
          onPress={handleCreateOrder}
          loading={createOrderMutation.isPending}
          disabled={submitDisabled}
          style={styles.submitButton}
          contentStyle={styles.submitButtonContent}
          icon="radioactive"
        >
          Place Imaging Order
        </Button>
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
  contextCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  contextHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  contextIcon: {
    backgroundColor: "#E7F5FF",
  },
  contextText: {
    flex: 1,
  },
  cardTitle: {
    fontWeight: "700",
  },
  mutedText: {
    opacity: 0.68,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  restrictedCard: {
    borderRadius: 12,
    marginBottom: 16,
    backgroundColor: "#FFF3BF",
  },
  formCard: {
    borderRadius: 12,
    marginBottom: 16,
  },
  input: {
    marginTop: 12,
  },
  fieldLabel: {
    marginTop: 16,
    marginBottom: 8,
    fontWeight: "700",
  },
  errorText: {
    color: "#C8102E",
    marginTop: 4,
  },
  modalityGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  modalityChip: {
    marginBottom: 4,
  },
  emptyState: {
    borderRadius: 12,
    padding: 16,
  },
  selectedModalityCard: {
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    backgroundColor: "#E6FCF5",
  },
  priorityRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  priorityChip: {
    flexGrow: 1,
  },
  divider: {
    marginVertical: 12,
  },
  previousCard: {
    borderRadius: 12,
    marginBottom: 16,
    backgroundColor: "#F8F9FA",
  },
  completedChip: {
    backgroundColor: "#D3F9D8",
  },
  submitButton: {
    borderRadius: 12,
  },
  submitButtonContent: {
    paddingVertical: 8,
  },
});
