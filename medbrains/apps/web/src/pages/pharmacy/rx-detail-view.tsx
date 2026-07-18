import type { PharmacyRxReviewFormInput } from "@medbrains/schemas";

// IPD RxDetailView — split from pharmacy.tsx (pure move).

import { Card, Group, Loader, Stack, Text } from "@mantine/core";
import type {
  PharmacyRxDetailResponse,
  PharmacyRxReviewItemInput,
  PrescriptionWithItems,
} from "@medbrains/types";
import {
  IconAlertTriangle,
  IconCheck,
  IconClock,
  IconShoppingCart,
  IconX,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { OperationalSignal, PrescriptionViews } from "@/components";
import { Alert, Badge, Button, Table } from "@/components/ui";
import { usePatientName } from "@/hooks/usePatientName";
import { instructionsDisplayText } from "@/lib/medication-timing-utils";
import { pharmacyService } from "@/services/pharmacy.service";
import { RxBillingEstimate } from "./rx-billing-estimate";
import {
  applyRxReviewItems,
  PharmacyPatientContext,
  rxReviewInputFromItem,
  rxStatusIcon,
  rxStatusLabel,
  rxStatusShape,
  rxStatusTone,
} from "./shared";

type PharmacyRxReviewAction = PharmacyRxReviewFormInput["action"];

export function RxDetailView({
  rxQueueId,
  canReview,
  reviewItems,
  onReviewItemsChange,
  canViewPatientRecord,
  onReview,
}: {
  rxQueueId: string;
  canReview: boolean;
  reviewItems: PharmacyRxReviewItemInput[];
  onReviewItemsChange: (items: PharmacyRxReviewItemInput[]) => void;
  canViewPatientRecord: boolean;
  onReview: (action: PharmacyRxReviewAction) => void;
}) {
  const { t } = useTranslation("pharmacy");
  const { data, isLoading, error } = useQuery({
    queryKey: ["pharmacy-rx-detail", rxQueueId],
    queryFn: () => pharmacyService.getRxDetail(rxQueueId),
    retry: 1,
  });
  const rxDetail = data as PharmacyRxDetailResponse | undefined;
  const rxPatientId = rxDetail?.prescription.patient_id;
  const { data: patientName } = usePatientName(canViewPatientRecord ? rxPatientId : undefined);

  if (isLoading) return <Loader />;
  if (error)
    return (
      <Alert tone="danger" title={t("notify.error")}>
        {String(error)}
      </Alert>
    );
  if (!rxDetail) return <Text c="dimmed">{t("rxQueue.noPrescriptionData")}</Text>;

  const { prescription, items: rxItems, allergies } = rxDetail;
  const pricedRxItems = applyRxReviewItems(rxItems, reviewItems);
  const allergyNames = (allergies as { allergen_name: string }[]).map((a) => a.allergen_name);
  const patientId = prescription.patient_id;
  const status = prescription.status;

  // Build PrescriptionWithItems format for the 4-view component
  const rxForViews: PrescriptionWithItems[] = [
    {
      prescription: {
        id: prescription.prescription_id as string,
        tenant_id: prescription.tenant_id,
        encounter_id: prescription.encounter_id,
        doctor_id: prescription.doctor_id,
        notes: null,
        order_mode: "written",
        transcribed_by: null,
        read_back_confirmed: false,
        countersign_due_at: null,
        is_signed: false,
        created_at: prescription.received_at,
        updated_at: prescription.received_at,
      },
      items: rxItems.map((it, idx) => ({
        id: `item-${idx}`,
        tenant_id: prescription.tenant_id,
        prescription_id: prescription.prescription_id,
        drug_name: it.drug_name,
        dosage: it.dosage,
        frequency: it.frequency,
        duration: it.duration,
        route: it.route ?? null,
        instructions: it.instructions ?? null,
        created_at: prescription.received_at,
        item_status: "active",
        discontinued_at: null,
        discontinued_by: null,
        discontinue_reason: null,
        catalog_item_id: it.catalog_item_id,
      })),
    },
  ];

  return (
    <Stack>
      <PharmacyPatientContext patientId={patientId} canViewPatientRecord={canViewPatientRecord} />
      {/* Allergy alert */}
      {allergyNames.length > 0 && (
        <Alert
          tone="danger"
          title={t("rxQueue.drugAllergies")}
          icon={<IconAlertTriangle size={16} />}
        >
          <Group gap={6}>
            {allergyNames.map((a) => (
              <Badge key={a} tone="danger" size="sm">
                {a}
              </Badge>
            ))}
          </Group>
        </Alert>
      )}

      <RxBillingEstimate
        items={pricedRxItems}
        editable={canReview && status === "pending_review"}
        reviewItems={reviewItems.length > 0 ? reviewItems : rxItems.map(rxReviewInputFromItem)}
        onReviewItemsChange={onReviewItemsChange}
      />

      {/* Status + actions */}
      <Group justify="space-between">
        <OperationalSignal
          icon={rxStatusIcon(status)}
          label={rxStatusLabel(t, status)}
          shape={rxStatusShape(status)}
          tone={rxStatusTone(status)}
        />
        <Group gap="xs">
          {canReview && status === "pending_review" && (
            <>
              <Button
                size="xs"
                tone="primary"
                leftSection={<IconCheck size={14} />}
                onClick={() => onReview("approved")}
              >
                {t("rxQueue.actions.approveAndCreateBilling")}
              </Button>
              <Button
                size="xs"
                tone="secondary"
                leftSection={<IconClock size={14} />}
                onClick={() => onReview("on_hold")}
              >
                {t("rxQueue.actions.hold")}
              </Button>
              <Button
                size="xs"
                tone="subtle-danger"
                leftSection={<IconX size={14} />}
                onClick={() => onReview("rejected")}
              >
                {t("rxQueue.actions.reject")}
              </Button>
            </>
          )}
          {status === "approved" && (
            <Button size="xs" tone="primary" leftSection={<IconShoppingCart size={14} />}>
              {t("rxQueue.actions.createDispenseOrder")}
            </Button>
          )}
        </Group>
      </Group>

      {/* Prescription items table */}
      <Card withBorder>
        <Table striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>#</Table.Th>
              <Table.Th>{t("rxDetail.columns.drug")}</Table.Th>
              <Table.Th>{t("rxDetail.columns.dosage")}</Table.Th>
              <Table.Th>{t("rxDetail.columns.frequency")}</Table.Th>
              <Table.Th>{t("rxDetail.columns.duration")}</Table.Th>
              <Table.Th>{t("rxDetail.columns.route")}</Table.Th>
              <Table.Th>{t("rxDetail.columns.instructions")}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rxItems.map((it, idx) => (
              <Table.Tr key={`${it.drug_name}-${it.dosage}-${it.frequency}`}>
                <Table.Td>{idx + 1}</Table.Td>
                <Table.Td fw={600}>{it.drug_name}</Table.Td>
                <Table.Td c="primary">{it.dosage}</Table.Td>
                <Table.Td>
                  <Badge size="xs">{it.frequency}</Badge>
                </Table.Td>
                <Table.Td>{it.duration}</Table.Td>
                <Table.Td>{it.route ?? "—"}</Table.Td>
                <Table.Td c="dimmed">{instructionsDisplayText(it.instructions) ?? "—"}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Card>

      {/* 4-view prescription display */}
      <PrescriptionViews
        prescriptions={rxForViews}
        patientName={
          canViewPatientRecord
            ? (patientName?.full_name ?? t("rxQueue.linkedPatient"))
            : t("rxQueue.restrictedPatient")
        }
        uhid={canViewPatientRecord ? (patientName?.uhid ?? "") : ""}
        allergies={allergyNames}
      />
    </Stack>
  );
}
