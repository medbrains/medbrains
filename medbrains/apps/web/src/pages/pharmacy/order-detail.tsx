// Pharmacy PharmacyOrderDetail — split from pharmacy.tsx (pure move).

import { Card, Group, SegmentedControl, Stack, Text, Tooltip } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useFieldAccess, useHasPermission } from "@medbrains/stores";
import type {
  ClinicalJourneyContext,
  PharmacyOrderDetailResponse,
  PharmacyOrderItem,
  PrescriptionWithItems,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import {
  IconCheck,
  IconClipboardList,
  IconReplace,
  IconShieldCheck,
  IconTrash,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";
import { PrescriptionViews, useClinicalEmit } from "@/components";
import { PatientFlowNavigator } from "@/components/Patient/PatientFlowNavigator";
import { PatientJourneyActions } from "@/components/Patient/PatientJourneyActions";
import { DispenseModal } from "@/components/Pharmacy/DispenseModal";
import { PharmacyDispensingView } from "@/components/Pharmacy/PharmacyDispensingView";
import { PharmacyLabel } from "@/components/Pharmacy/PharmacyLabel";
import { RepeatPanel } from "@/components/Pharmacy/RepeatPanel";
import { SubstituteModal } from "@/components/Pharmacy/SubstituteModal";
import { Alert, Badge, Button, IconButton, Table, toast } from "@/components/ui";
import { usePatientName } from "@/hooks/usePatientName";
import { confirmDestructive } from "@/lib/confirm-destructive";
import { pharmacyService } from "@/services/pharmacy.service";
import { pharmacyOrderJourneyContext } from "../pharmacy-workspace";
import { EditablePharmacyQuantity } from "./editable-quantity";
import { NearExpiryHints } from "./near-expiry-hints";
import { PrescriptionAuditTrail } from "./prescription-audit-trail";
import {
  dispensingTypeLabels,
  ExpiryCell,
  PharmacyPatientContext,
  pharmacyOrderEventItems,
  renderPharmacySensitiveCurrency,
  renderPharmacySensitiveValue,
  sharedColorBadgeTone,
  statusColors,
} from "./shared";

export function PharmacyOrderDetail({
  orderId,
  canEditItems,
  canDispense,
  canViewReturns,
  canViewPatientRecord,
}: {
  orderId: string;
  canEditItems: boolean;
  canDispense: boolean;
  canViewReturns: boolean;
  canViewPatientRecord: boolean;
}) {
  const { t } = useTranslation("pharmacy");
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showAudit, setShowAudit] = useState(false);
  const [showLabels, setShowLabels] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "schedule">("schedule");
  const emit = useClinicalEmit();
  const batchNumberAccess = useFieldAccess("pharmacy.batches.batch_number");
  const priceAccess = useFieldAccess("pharmacy.pricing.unit_price");
  const { data } = useQuery({
    queryKey: ["pharmacy-order-detail", orderId],
    queryFn: () => pharmacyService.getPharmacyOrder(orderId),
  });

  // Fetch linked prescription for structured timing data
  const detail = data as PharmacyOrderDetailResponse | undefined;
  const prescriptionId = detail?.order.prescription_id;
  const { data: rxData } = useQuery<PrescriptionWithItems>({
    queryKey: ["prescription-detail", prescriptionId],
    queryFn: () => pharmacyService.getPrescription(prescriptionId as string),
    enabled: !!prescriptionId,
  });

  // Patient identity for labels — UUID slice is medically dangerous on a
  // dispensed-medication label, so resolve to real name + UHID.
  const { data: patientName } = usePatientName(
    canViewPatientRecord ? detail?.order.patient_id : undefined,
  );

  const updateItemMutation = useMutation({
    mutationFn: ({ itemId, quantity }: { itemId: string; quantity: number }) =>
      pharmacyService.updatePharmacyOrderItem(orderId, itemId, { quantity }),
    onSuccess: (next) => {
      queryClient.setQueryData(["pharmacy-order-detail", orderId], next);
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-orders"] });
      void queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Order item and draft billing line were updated", {
        title: "Quantity updated",
      });
    },
  });

  const removeItemMutation = useMutation({
    mutationFn: (itemId: string) => pharmacyService.removePharmacyOrderItem(orderId, itemId),
    onSuccess: (next) => {
      queryClient.setQueryData(["pharmacy-order-detail", orderId], next);
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-orders"] });
      void queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Order item was removed and the draft billing line was reversed", {
        title: "Item removed",
      });
    },
  });

  const clearDispenseHandoff = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("action");
    setSearchParams(next, { replace: true });
  };
  const [dispenseOpen, dispenseModal] = useDisclosure(false);
  // Active drug allergens for the dispense-time allergy guard.
  const { data: patientAllergies = [] } = useQuery({
    queryKey: ["patient-allergies", detail?.order.patient_id],
    queryFn: () => pharmacyService.listPatientAllergies(detail?.order.patient_id ?? ""),
    enabled: dispenseOpen && Boolean(detail?.order.patient_id),
  });
  const drugAllergens = patientAllergies
    .filter((a) => a.is_active && a.allergy_type === "drug")
    .map((a) => a.allergen_name);
  const dispenseMutation = useMutation({
    mutationFn: async (payload?: {
      items: { order_item_id: string; batch_stock_id?: string; quantity: number }[];
      witnessed_by?: string;
      allergy_override_reason?: string;
    }) => {
      const currentDetail = await pharmacyService.getPharmacyOrder(orderId);
      const order = await pharmacyService.dispenseOrder(orderId, payload);
      return { admissionId: currentDetail.admission_id, items: currentDetail.items, order };
    },
    onSuccess: ({ admissionId, items, order }) => {
      dispenseModal.close();
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-orders"] });
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-order-detail", orderId] });
      void queryClient.invalidateQueries({ queryKey: ["invoices"] });
      void queryClient.invalidateQueries({ queryKey: ["invoice"] });
      void queryClient.invalidateQueries({ queryKey: ["patient-invoices", order.patient_id] });
      toast.success("Order dispensed and linked billing charges refreshed", {
        title: "Dispensed",
      });
      emit("pharmacy.order.dispensed", {
        admission_id: admissionId,
        dispensing_type: order.dispensing_type,
        encounter_id: order.encounter_id,
        items: pharmacyOrderEventItems(items),
        order_id: orderId,
        order_type: "pharmacy",
        patient_id: order.patient_id,
      });
      clearDispenseHandoff();
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not dispense order" }),
  });

  const canSubstituteDrug = useHasPermission(P.PHARMACY_IMPROVEMENTS.SUBSTITUTION_RECORD);
  const { data: detailCatalog = [] } = useQuery({
    queryKey: ["pharmacy-catalog"],
    queryFn: () => pharmacyService.listPharmacyCatalog(),
    staleTime: 300_000,
    enabled: canSubstituteDrug,
  });
  const [substituteItem, setSubstituteItem] = useState<PharmacyOrderItem | null>(null);

  if (!detail) return <Text c="dimmed">Loading...</Text>;

  const hasRxItems = rxData && rxData.items.length > 0;
  const canEditOrderItems = canEditItems && detail.order.status === "ordered";
  const canSubstitute =
    canSubstituteDrug &&
    (detail.order.status === "ordered" || detail.order.status === "partially_dispensed");
  const showItemActions = canEditOrderItems || canSubstitute;
  const isDispenseHandoff = searchParams.get("action") === "dispense";
  const isAwaitingDispense = detail.order.status === "ordered";
  const dispenseHandoffMessage = !isAwaitingDispense
    ? t("handoff.dispense.completed")
    : canDispense
      ? t("handoff.dispense.ready")
      : t("handoff.dispense.permissionRequired");
  const canPrintMedicationLabels = canViewPatientRecord && hasRxItems;
  const prescriptionPatientName = canViewPatientRecord
    ? (patientName?.full_name ?? "Linked patient")
    : "Patient restricted";
  const prescriptionUhid = canViewPatientRecord ? (patientName?.uhid ?? "") : "";
  const journeyContext: ClinicalJourneyContext = pharmacyOrderJourneyContext(detail);
  const completedEvents = journeyContext.completedEvents ?? [];

  return (
    <Stack>
      <DispenseModal
        opened={dispenseOpen}
        onClose={dispenseModal.close}
        items={detail.items}
        isDispensing={dispenseMutation.isPending}
        patientAllergens={drugAllergens}
        onDispense={(payload) => dispenseMutation.mutate(payload)}
      />
      {substituteItem && (
        <SubstituteModal
          opened={Boolean(substituteItem)}
          onClose={() => setSubstituteItem(null)}
          item={substituteItem}
          catalog={detailCatalog}
        />
      )}
      <Group justify="space-between">
        <Text fw={700}>Order: {detail.order.id.slice(0, 8)}...</Text>
        <Group gap="xs">
          {canDispense &&
            (detail.order.status === "ordered" ||
              detail.order.status === "partially_dispensed") && (
              <Button
                size="xs"
                tone="primary"
                leftSection={<IconCheck size={14} />}
                loading={dispenseMutation.isPending}
                onClick={dispenseModal.open}
              >
                Dispense
              </Button>
            )}
          <Badge tone={sharedColorBadgeTone(statusColors[detail.order.status])} size="lg">
            {detail.order.status}
          </Badge>
          <Badge variant="outline" size="sm">
            {dispensingTypeLabels[detail.order.dispensing_type] ?? detail.order.dispensing_type}
          </Badge>
        </Group>
      </Group>
      {detail.order.dispensed_at && (
        <Text size="xs" c="dimmed">
          Dispensed: {new Date(detail.order.dispensed_at).toLocaleString()}
        </Text>
      )}
      {detail.order.prescription_id && (
        <RepeatPanel
          prescriptionId={detail.order.prescription_id}
          pharmacyOrderId={detail.order.id}
        />
      )}
      {canEditOrderItems && (
        <Alert tone="info" icon={<IconShieldCheck size={16} />}>
          Edit or remove medicines before dispense. Draft billing lines stay synchronized.
        </Alert>
      )}
      <PharmacyPatientContext
        patientId={detail.order.patient_id}
        canViewPatientRecord={canViewPatientRecord}
      />
      <PatientFlowNavigator
        patientId={detail.order.patient_id}
        active="pharmacy"
        activeEncounterId={detail.order.encounter_id ?? null}
        activeAdmissionId={detail.admission_id}
        activeInvoiceId={detail.billing_invoice_id}
        activePharmacyOrderId={detail.order.id}
        activeOrderContext={detail.admission_id ? "ipd" : detail.order.encounter_id ? "opd" : null}
        completedEvents={completedEvents}
        compact
      />
      {isDispenseHandoff && (
        <Alert tone="success" title={t("handoff.dispense.title")}>
          <Group justify="space-between" align="center" gap="sm">
            <Text size="sm">{dispenseHandoffMessage}</Text>
            <Group gap="xs">
              {isAwaitingDispense && canDispense && (
                <Button
                  size="xs"
                  tone="primary"
                  leftSection={<IconCheck size={14} />}
                  loading={dispenseMutation.isPending}
                  onClick={dispenseModal.open}
                >
                  {t("button.dispenseOrder")}
                </Button>
              )}
              <Button size="xs" tone="ghost" onClick={clearDispenseHandoff}>
                {t("button.dismiss")}
              </Button>
            </Group>
          </Group>
        </Alert>
      )}
      <Card withBorder padding="sm">
        <Group justify="space-between" gap="sm" align="center">
          <Stack gap={2}>
            <Text size="xs" fw={700} c="dimmed" tt="uppercase">
              {t("handoff.patient.title")}
            </Text>
            <Text size="xs" c="dimmed">
              {t("handoff.patient.message")}
            </Text>
          </Stack>
          <PatientJourneyActions
            context={journeyContext}
            hiddenActionIds={["pharmacy.open_patient_queue"]}
            size="xs"
          />
        </Group>
      </Card>

      {/* View mode toggle — show schedule view when prescription data is available */}
      {hasRxItems && (
        <SegmentedControl
          size="xs"
          value={viewMode}
          onChange={(v) => setViewMode(v as "table" | "schedule")}
          data={[
            { value: "schedule", label: "Medication Schedule" },
            { value: "table", label: "Order Table" },
          ]}
        />
      )}

      {/* Schedule view — time-grouped with timing/food instructions */}
      {viewMode === "schedule" && hasRxItems ? (
        <PharmacyDispensingView items={rxData.items} />
      ) : (
        <Table striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Drug</Table.Th>
              <Table.Th>Batch</Table.Th>
              <Table.Th>Expiry</Table.Th>
              <Table.Th>Qty</Table.Th>
              <Table.Th>Unit Price</Table.Th>
              <Table.Th>Total</Table.Th>
              {canViewReturns && <Table.Th>Returned</Table.Th>}
              {showItemActions && <Table.Th>Actions</Table.Th>}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {detail.items.map((item) => (
              <Table.Tr key={item.id}>
                <Table.Td>{item.drug_name}</Table.Td>
                <Table.Td>
                  {renderPharmacySensitiveValue(batchNumberAccess, item.batch_number)}
                </Table.Td>
                <Table.Td>
                  {item.expiry_date ? <ExpiryCell date={item.expiry_date} /> : "\u2014"}
                </Table.Td>
                <Table.Td>
                  {canEditOrderItems ? (
                    <EditablePharmacyQuantity
                      key={`${item.id}-${item.quantity}`}
                      item={item}
                      isSaving={updateItemMutation.isPending}
                      onSave={(quantity) =>
                        updateItemMutation.mutate({ itemId: item.id, quantity })
                      }
                    />
                  ) : (
                    item.quantity
                  )}
                </Table.Td>
                <Table.Td>{renderPharmacySensitiveCurrency(priceAccess, item.unit_price)}</Table.Td>
                <Table.Td>
                  {renderPharmacySensitiveCurrency(priceAccess, item.total_price)}
                </Table.Td>
                {canViewReturns && (
                  <Table.Td>{item.quantity_returned > 0 ? item.quantity_returned : "—"}</Table.Td>
                )}
                {showItemActions && (
                  <Table.Td>
                    <Group gap={4} wrap="nowrap">
                      {canSubstitute && (
                        <Tooltip label="Substitute medication">
                          <IconButton
                            size="sm"
                            tone="default"
                            onClick={() => setSubstituteItem(item)}
                            aria-label={`Substitute ${item.drug_name}`}
                          >
                            <IconReplace size={14} />
                          </IconButton>
                        </Tooltip>
                      )}
                      {canEditOrderItems && (
                        <Tooltip
                          label={
                            detail.items.length <= 1
                              ? "At least one item must remain"
                              : "Remove item before dispense"
                          }
                        >
                          <IconButton
                            size="sm"
                            tone="danger"
                            disabled={detail.items.length <= 1 || removeItemMutation.isPending}
                            onClick={() =>
                              confirmDestructive({
                                title: "Remove drug",
                                message: `Remove ${item.drug_name} from this order?`,
                                confirmLabel: "Remove drug",
                                onConfirm: () => removeItemMutation.mutate(item.id),
                              })
                            }
                            aria-label={`Remove ${item.drug_name}`}
                          >
                            <IconTrash size={14} />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Group>
                  </Table.Td>
                )}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      {/* FEFO assistance: when the order is awaiting dispense, surface
          earliest-expiry batches so the dispenser doesn't need to flip
          to the Batches tab to apply First-Expiry-First-Out. */}
      {detail.order.status === "ordered" && detail.items.length > 0 && (
        <NearExpiryHints drugNames={Array.from(new Set(detail.items.map((i) => i.drug_name)))} />
      )}

      <Group gap="xs">
        <Button
          tone="secondary"
          size="xs"
          leftSection={<IconClipboardList size={14} />}
          onClick={() => setShowAudit(!showAudit)}
        >
          {showAudit ? "Hide" : "Show"} Prescription Audit Trail
        </Button>
        {canPrintMedicationLabels && (
          <Button tone="secondary" size="xs" onClick={() => setShowLabels(!showLabels)}>
            {showLabels ? "Hide" : "Print"} Medication Labels
          </Button>
        )}
      </Group>
      {showAudit && <PrescriptionAuditTrail prescriptionId={orderId} />}
      {showLabels && canPrintMedicationLabels && (
        <PharmacyLabel
          items={rxData.items}
          patientName={prescriptionPatientName}
          uhid={prescriptionUhid}
          date={new Date().toLocaleDateString()}
        />
      )}

      {hasRxItems && (
        <PrescriptionViews
          prescriptions={[rxData]}
          patientName={prescriptionPatientName}
          uhid={prescriptionUhid}
          allergies={[]}
        />
      )}
    </Stack>
  );
}
