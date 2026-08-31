// RxQueueTab — split from pharmacy.tsx (pure move). Not IPD despite the original label:
// every row in pharmacy_prescriptions belongs to an OPD encounter.

import { zodResolver } from "@hookform/resolvers/zod";
import { Drawer, Group, Select, Stack, Text, Textarea, Tooltip } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { PharmacyRxReviewFormInput } from "@medbrains/schemas";
import { pharmacyRxReviewFormSchema } from "@medbrains/schemas";
import type { PharmacyRxReviewItemInput, RxQueueRow } from "@medbrains/types";
import { PATIENT_BASIC_IDENTITY_FIELD_ACCESS_KEYS } from "@medbrains/types";
import {
  IconAlertTriangle,
  IconCheck,
  IconClock,
  IconEye,
  IconPill,
  IconPrescription,
  IconShieldCheck,
  IconX,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";
import type { Column } from "@/components";
import { DataTable, FormModal, OperationalSignal } from "@/components";
import { Alert, Button, IconButton, toast } from "@/components/ui";
import { optionalFormText } from "@/forms/pharmacy.form";
import { pharmacyService } from "@/services/pharmacy.service";
import { RxBillingEstimate } from "./rx-billing-estimate";
import { RxDetailView } from "./rx-detail-view";
import {
  applyRxReviewItems,
  DEFAULT_RX_REVIEW_FORM_VALUES,
  PharmacyPatientCell,
  PharmacyPatientContext,
  rxHasPriceOverride,
  rxPriorityLabel,
  rxPriorityShape,
  rxPriorityTone,
  rxReviewInputFromItem,
  rxReviewInputsFromForm,
  rxSourceLabel,
  rxSourceShape,
  rxSourceTone,
  rxStatusIcon,
  rxStatusLabel,
  rxStatusShape,
  rxStatusTone,
} from "./shared";

type PharmacyRxReviewAction = PharmacyRxReviewFormInput["action"];

export function RxQueueTab({
  canReview,
  canViewQueue,
  canViewPatientRecord,
}: {
  canReview: boolean;
  canViewQueue: boolean;
  canViewPatientRecord: boolean;
}) {
  const { t } = useTranslation("pharmacy");
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [localSelectedId, setLocalSelectedId] = useState<string | null>(null);
  const [reviewOpened, { open: openReview, close: closeReview }] = useDisclosure(false);
  const patientIdFilter = searchParams.get("patient_id")?.trim() || null;
  const rxQueueIdFilter = searchParams.get("rx_queue_id")?.trim() || null;
  const selectedId = localSelectedId ?? rxQueueIdFilter;
  const {
    control: reviewControl,
    reset: resetReviewForm,
    handleSubmit: handleSubmitReviewForm,
    setValue: setReviewFormValue,
    watch: watchReviewForm,
    formState: { errors: reviewErrors },
  } = useForm<PharmacyRxReviewFormInput>({
    resolver: zodResolver(pharmacyRxReviewFormSchema),
    defaultValues: DEFAULT_RX_REVIEW_FORM_VALUES,
  });
  const reviewAction = watchReviewForm("action");
  const reviewNotes = watchReviewForm("notes");
  const reviewItems = rxReviewInputsFromForm(watchReviewForm("items"));
  const rxStatusOptions = useMemo(
    () =>
      ["pending_review", "dispensing", "rejected", "on_hold"].map((status) => ({
        value: status,
        label: rxStatusLabel(t, status),
      })),
    [t],
  );

  function setReviewItems(items: PharmacyRxReviewItemInput[]) {
    setReviewFormValue("items", items, {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  function setActiveRxQueueId(id: string | null) {
    setLocalSelectedId(id);
    const next = new URLSearchParams(searchParams);
    if (id) {
      next.set("tab", "rx-queue");
      next.set("rx_queue_id", id);
    } else {
      next.delete("rx_queue_id");
    }
    setSearchParams(next, { replace: true });
  }

  function clearRxQueueHandoff() {
    setLocalSelectedId(null);
    const next = new URLSearchParams(searchParams);
    next.delete("patient_id");
    next.delete("rx_queue_id");
    setSearchParams(next, { replace: true });
  }

  const params =
    filterStatus || patientIdFilter || rxQueueIdFilter
      ? {
          ...(filterStatus ? { status: filterStatus } : {}),
          ...(patientIdFilter ? { patient_id: patientIdFilter } : {}),
          ...(rxQueueIdFilter ? { rx_queue_id: rxQueueIdFilter } : {}),
        }
      : undefined;
  const { data: queue = [], isLoading } = useQuery({
    queryKey: ["pharmacy-rx-queue", params],
    queryFn: () => pharmacyService.listRxQueue(params),
    refetchInterval: 15_000,
  });

  const reviewMutation = useMutation({
    mutationFn: (data: {
      id: string;
      action: string;
      notes?: string;
      rejection_reason?: string;
      items?: PharmacyRxReviewItemInput[];
    }) =>
      pharmacyService.reviewPrescription(data.id, {
        action: data.action,
        notes: data.notes,
        rejection_reason: data.rejection_reason,
        items: data.items,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pharmacy-rx-queue"] });
      queryClient.invalidateQueries({ queryKey: ["pharmacy-orders"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["billing-report-daily"] });
      closeReview();
      setActiveRxQueueId(null);
      resetReviewForm(DEFAULT_RX_REVIEW_FORM_VALUES);
      toast.success(
        reviewAction === "approved"
          ? t("notify.pharmacyOrderAndBillingIndentCreated")
          : t("notify.rxQueueStatusUpdated"),
        { title: t("notify.prescriptionReviewed") },
      );
    },
  });

  const { data: reviewDetail, isLoading: reviewDetailLoading } = useQuery({
    queryKey: ["pharmacy-rx-detail", selectedId],
    queryFn: () => {
      if (!selectedId) throw new Error(t("rxQueue.noPrescriptionSelected"));
      return pharmacyService.getRxDetail(selectedId);
    },
    enabled: reviewOpened && reviewAction === "approved" && Boolean(selectedId),
  });

  function closeReviewModal() {
    closeReview();
    setActiveRxQueueId(null);
    resetReviewForm(DEFAULT_RX_REVIEW_FORM_VALUES);
  }

  function handleOpenReview(id: string, action: PharmacyRxReviewAction) {
    if (selectedId !== id) {
      resetReviewForm({
        ...DEFAULT_RX_REVIEW_FORM_VALUES,
        action,
      });
    } else {
      setReviewFormValue("action", action, { shouldDirty: true });
    }
    setActiveRxQueueId(id);
    openReview();
  }

  function handleSubmitReview(values: PharmacyRxReviewFormInput) {
    if (!selectedId) return;
    const baseItems = reviewDetail?.items ?? [];
    const reviewedItems = rxReviewInputsFromForm(values.items);
    const itemsForApproval =
      values.action === "approved"
        ? reviewedItems.length > 0
          ? reviewedItems
          : baseItems.map(rxReviewInputFromItem)
        : undefined;
    reviewMutation.mutate({
      id: selectedId,
      action: values.action,
      notes: optionalFormText(values.notes),
      rejection_reason:
        values.action === "rejected" ? optionalFormText(values.rejection_reason) : undefined,
      items: itemsForApproval,
    });
  }

  const columns: Column<RxQueueRow>[] = [
    {
      key: "patient_name",
      label: t("rxQueue.columns.patient"),
      sortable: true,
      searchable: true,
      fieldAccessKeys: PATIENT_BASIC_IDENTITY_FIELD_ACCESS_KEYS,
      accessor: (row: RxQueueRow) => row.patient_name,
      fieldKind: "name",
      hiddenLabel: t("rxQueue.restrictedPatient"),
      render: (row: RxQueueRow) => (
        <PharmacyPatientCell
          patientId={row.patient_id}
          canViewPatientRecord={canViewPatientRecord}
        />
      ),
    },
    {
      key: "doctor_name",
      label: t("rxQueue.columns.doctor"),
      sortable: true,
      searchable: true,
      accessor: (row: RxQueueRow) => row.doctor_name,
      render: (row: RxQueueRow) => <Text size="sm">{row.doctor_name}</Text>,
    },
    {
      key: "source",
      label: t("rxQueue.columns.source"),
      render: (row: RxQueueRow) => (
        <OperationalSignal
          icon={IconPrescription}
          label={rxSourceLabel(t, row.source)}
          shape={rxSourceShape(row.source)}
          size="xs"
          tone={rxSourceTone(row.source)}
        />
      ),
    },
    {
      key: "priority",
      label: t("rxQueue.columns.priority"),
      render: (row: RxQueueRow) => (
        <OperationalSignal
          icon={row.priority === "urgent" || row.priority === "high" ? IconAlertTriangle : IconPill}
          label={rxPriorityLabel(t, row.priority)}
          shape={rxPriorityShape(row.priority)}
          size="xs"
          tone={rxPriorityTone(row.priority)}
        />
      ),
    },
    {
      key: "status",
      label: t("rxQueue.columns.status"),
      render: (row: RxQueueRow) => (
        <OperationalSignal
          icon={rxStatusIcon(row.status)}
          label={rxStatusLabel(t, row.status)}
          shape={rxStatusShape(row.status)}
          size="xs"
          tone={rxStatusTone(row.status)}
        />
      ),
    },
    {
      key: "allergy_count",
      label: t("rxQueue.columns.allergies"),
      sortable: true,
      sortValue: (row: RxQueueRow) => row.allergy_count,
      accessor: (row: RxQueueRow) => row.allergy_count,
      render: (row: RxQueueRow) =>
        row.allergy_count > 0 ? (
          <OperationalSignal
            icon={IconAlertTriangle}
            label={t("rxQueue.allergy.alerts", { count: row.allergy_count })}
            shape="diamond"
            size="xs"
            tone="risk"
            value={String(row.allergy_count)}
          />
        ) : (
          <OperationalSignal
            icon={IconShieldCheck}
            label={t("rxQueue.allergy.none")}
            shape="pill"
            size="xs"
            tone="ready"
          />
        ),
    },
    {
      key: "received_at",
      label: t("rxQueue.columns.received"),
      sortable: true,
      sortValue: (row: RxQueueRow) => row.received_at,
      accessor: (row: RxQueueRow) => new Date(row.received_at).toLocaleTimeString(),
      render: (row: RxQueueRow) => (
        <Text size="sm">{new Date(row.received_at).toLocaleTimeString()}</Text>
      ),
    },
    {
      key: "actions",
      label: t("rxQueue.columns.actions"),
      render: (row: RxQueueRow) => (
        <Group gap={4}>
          <Tooltip label={t("rxQueue.actions.viewPrescription")}>
            <IconButton
              size="sm"
              tone="primary"
              onClick={() => {
                setReviewItems([]);
                setActiveRxQueueId(row.id);
              }}
              aria-label={t("rxQueue.actions.viewPrescriptionDetails")}
            >
              <IconEye size={14} />
            </IconButton>
          </Tooltip>
          {canReview && row.status === "pending_review" && (
            <>
              <Tooltip label={t("rxQueue.actions.approveAndCreateBillingIndent")}>
                <IconButton
                  size="sm"
                  tone="success"
                  onClick={() => handleOpenReview(row.id, "approved")}
                  aria-label={t("rxQueue.actions.approvePrescriptionReview")}
                >
                  <IconCheck size={14} />
                </IconButton>
              </Tooltip>
              <Tooltip label={t("rxQueue.actions.holdForReview")}>
                <IconButton
                  size="sm"
                  tone="default"
                  onClick={() => handleOpenReview(row.id, "on_hold")}
                  aria-label={t("rxQueue.actions.holdPrescriptionForReview")}
                >
                  <IconClock size={14} />
                </IconButton>
              </Tooltip>
              <Tooltip label={t("rxQueue.actions.rejectPrescription")}>
                <IconButton
                  size="sm"
                  tone="danger"
                  onClick={() => handleOpenReview(row.id, "rejected")}
                  aria-label={t("rxQueue.actions.rejectPrescription")}
                >
                  <IconX size={14} />
                </IconButton>
              </Tooltip>
            </>
          )}
        </Group>
      ),
    },
  ];

  const needsPriceOverrideReason =
    reviewAction === "approved" &&
    rxHasPriceOverride(reviewDetail?.items ?? [], reviewItems) &&
    !reviewNotes.trim();

  return (
    <Stack>
      {!canViewQueue && canReview && (
        <Alert tone="info" icon={<IconShieldCheck size={16} />}>
          {t("rxQueue.reviewOnlyAccess")}
        </Alert>
      )}
      <Group justify="space-between">
        <Stack gap={2}>
          <Text fw={600}>{t("rxQueue.title")}</Text>
          {patientIdFilter && (
            <Text size="xs" c="dimmed">
              {t("rxQueue.filteredToPatient")}
            </Text>
          )}
        </Stack>
        <Select
          size="xs"
          placeholder={t("rxQueue.allStatuses")}
          clearable
          w={180}
          data={rxStatusOptions}
          value={filterStatus}
          onChange={setFilterStatus}
        />
      </Group>
      {patientIdFilter && (
        <PharmacyPatientContext
          patientId={patientIdFilter}
          canViewPatientRecord={canViewPatientRecord}
        />
      )}
      {(patientIdFilter || rxQueueIdFilter) && (
        <Alert tone="success" title={t("handoff.prescriptionReview.title")}>
          <Group justify="space-between" align="center" gap="sm">
            <Text size="sm">{t("handoff.prescriptionReview.message")}</Text>
            <Button size="xs" tone="ghost" onClick={clearRxQueueHandoff}>
              {t("button.clearHandoff")}
            </Button>
          </Group>
        </Alert>
      )}
      <DataTable
        columns={columns}
        data={queue}
        loading={isLoading}
        rowKey={(row) => row.id}
        searchable
        searchPlaceholder={t("rxQueue.searchPlaceholder", "Search patient or doctor")}
        exportable
        exportFileName="pharmacy-rx-queue"
      />

      {/* Prescription Detail Drawer */}
      <Drawer
        opened={Boolean(selectedId) && !reviewOpened}
        onClose={() => setActiveRxQueueId(null)}
        title={t("rxQueue.prescriptionDetail")}
        position="right"
        size="min(100%, 1040px)"
      >
        {selectedId && (
          <RxDetailView
            rxQueueId={selectedId}
            canReview={canReview}
            reviewItems={reviewItems}
            onReviewItemsChange={setReviewItems}
            canViewPatientRecord={canViewPatientRecord}
            onReview={(action) => {
              handleOpenReview(selectedId, action);
            }}
          />
        )}
      </Drawer>

      <FormModal
        opened={reviewOpened}
        onClose={closeReviewModal}
        title={t(`rxReviewModal.title.${reviewAction}`)}
        size="min(100%, 980px)"
        onSubmit={handleSubmitReviewForm(handleSubmitReview)}
        submitLabel={
          reviewAction === "approved"
            ? t("rxReviewModal.approveAndCreateBillingIndent")
            : reviewAction === "on_hold"
              ? t("rxReviewModal.putOnHold")
              : t("rxReviewModal.reject")
        }
        submitColor={
          reviewAction === "rejected"
            ? "danger"
            : reviewAction === "on_hold"
              ? "warning"
              : "success"
        }
        submitting={reviewMutation.isPending}
        submitDisabled={needsPriceOverrideReason || Boolean(reviewErrors.items?.message)}
      >
        <Controller
          control={reviewControl}
          name="notes"
          render={({ field, fieldState }) => (
            <Textarea
              label={
                reviewAction === "approved"
                  ? t("rxReviewModal.reviewNotesPriceOverride")
                  : t("label.notes")
              }
              value={field.value}
              onChange={field.onChange}
              error={fieldState.error?.message}
            />
          )}
        />
        {reviewAction === "rejected" && (
          <Controller
            control={reviewControl}
            name="rejection_reason"
            render={({ field, fieldState }) => (
              <Textarea
                label={t("rxReviewModal.rejectionReason")}
                required
                value={field.value}
                onChange={field.onChange}
                error={fieldState.error?.message}
              />
            )}
          />
        )}
        {reviewAction === "approved" && (
          <RxBillingEstimate
            items={applyRxReviewItems(reviewDetail?.items ?? [], reviewItems)}
            loading={reviewDetailLoading}
            editable
            reviewItems={
              reviewItems.length > 0
                ? reviewItems
                : (reviewDetail?.items ?? []).map(rxReviewInputFromItem)
            }
            onReviewItemsChange={setReviewItems}
          />
        )}
        {needsPriceOverrideReason && (
          <Alert tone="warning" icon={<IconAlertTriangle size={16} />}>
            {t("rxReviewModal.priceOverrideReasonRequired")}
          </Alert>
        )}
      </FormModal>
    </Stack>
  );
}

/** Detail view for a single Rx queue entry — shows prescription items, allergies, 4 views */
