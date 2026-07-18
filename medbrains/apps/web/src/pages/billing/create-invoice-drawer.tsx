// Billing CreateInvoiceDrawer — split from billing.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import { Text, Textarea, TextInput } from "@mantine/core";
import type { BillingCreateInvoiceFormInput } from "@medbrains/schemas";
import { billingCreateInvoiceFormSchema } from "@medbrains/schemas";
import type { CreateInvoiceRequest } from "@medbrains/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { FormModal, useClinicalEmit } from "@/components";
import { PatientContextBanner } from "@/components/Patient/PatientContextBanner";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { toast } from "@/components/ui";
import { billingOptionalText } from "@/forms/billing.form";
import { billingService } from "@/services/billing.service";

export function CreateInvoiceDrawer({
  opened,
  onClose,
  initialPatientId,
  initialEncounterId,
  initialAdmissionId,
}: {
  opened: boolean;
  onClose: () => void;
  initialPatientId: string;
  initialEncounterId: string;
  initialAdmissionId: string;
}) {
  const { t } = useTranslation("billing");
  const emit = useClinicalEmit();
  const queryClient = useQueryClient();
  const invoiceDefaults: BillingCreateInvoiceFormInput = {
    patient_id: initialPatientId,
    encounter_id: initialEncounterId,
    admission_id: initialAdmissionId,
    notes: "",
  };
  const {
    control,
    register,
    reset,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<BillingCreateInvoiceFormInput>({
    resolver: zodResolver(billingCreateInvoiceFormSchema),
    defaultValues: invoiceDefaults,
  });
  const invoiceFieldError = (field: keyof BillingCreateInvoiceFormInput) => {
    const message = errors[field]?.message;
    if (!message) return undefined;
    if (field === "patient_id") return t("validation.patientRequired");
    return t("validation.invalidField");
  };
  const createInvoiceErrorMessage = (error: Error) => {
    if (error.message === "billing.error.admissionNotFound") {
      return t("error.admissionNotFound");
    }
    if (error.message === "billing.error.admissionPatientMismatch") {
      return t("error.admissionPatientMismatch");
    }
    if (error.message === "billing.error.encounterAdmissionMismatch") {
      return t("error.encounterAdmissionMismatch");
    }
    return t("notification.createInvoiceFailed");
  };

  const createMutation = useMutation({
    mutationFn: (data: CreateInvoiceRequest) => billingService.createInvoice(data),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["invoices"] });
      void queryClient.invalidateQueries({ queryKey: ["patient-invoices", result.patient_id] });
      toast.success(t("notification.draftInvoiceCreated"), {
        title: t("notification.invoiceCreatedTitle"),
      });
      emit("billing.invoice.created", {
        admission_id: result.admission_id,
        encounter_id: result.encounter_id,
        invoice_id: result.id,
        patient_id: result.patient_id,
        total_amount: result.total_amount,
      });
      onClose();
      reset(invoiceDefaults);
    },
    onError: (error: Error) => {
      toast.error(createInvoiceErrorMessage(error), {
        title: t("notification.errorTitle"),
      });
    },
  });
  const patientId = watch("patient_id");
  const contextPatientId = patientId.trim().length >= 32 ? patientId.trim() : null;
  const closeDrawer = () => {
    reset(invoiceDefaults);
    onClose();
  };
  const submitInvoice = handleSubmit((values) => {
    createMutation.mutate({
      patient_id: values.patient_id.trim(),
      encounter_id: billingOptionalText(values.encounter_id),
      admission_id: billingOptionalText(values.admission_id),
      notes: billingOptionalText(values.notes),
    });
  });

  return (
    <FormModal
      opened={opened}
      onClose={closeDrawer}
      title={t("title.createInvoice")}
      variant="drawer"
      size="xl"
      onSubmit={submitInvoice}
      submitLabel={t("button.createDraftInvoice")}
      submitting={createMutation.isPending}
    >
      <Controller
        control={control}
        name="patient_id"
        render={({ field }) => (
          <PatientSearchSelect value={field.value} onChange={field.onChange} required />
        )}
      />
      {errors.patient_id?.message && (
        <Text size="xs" c="danger">
          {invoiceFieldError("patient_id")}
        </Text>
      )}
      {contextPatientId && (
        <PatientContextBanner patientId={contextPatientId} hideLoadingState variant="financial" />
      )}
      <TextInput
        label={t("label.encounterId")}
        error={invoiceFieldError("encounter_id")}
        {...register("encounter_id")}
      />
      <TextInput
        label={t("label.admissionId")}
        error={invoiceFieldError("admission_id")}
        {...register("admission_id")}
      />
      <Textarea
        label={t("label.notes")}
        error={invoiceFieldError("notes")}
        {...register("notes")}
      />
    </FormModal>
  );
}

// Cashiers work the invoice, not the clinical journey — the flow
// navigator above already covers cross-module navigation, so the
// action row keeps only billing moves (payment, discharge bill).
