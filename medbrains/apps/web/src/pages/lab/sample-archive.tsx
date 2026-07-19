// Lab SampleArchiveSection — split from lab.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import { Group, Stack, Text, Textarea, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { LabSampleArchiveFormInput } from "@medbrains/schemas";
import { labSampleArchiveFormSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type { CreateSampleArchiveRequest, LabSampleArchive } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { DataTable } from "@/components";
import { PatientNameCell } from "@/components/PatientNameCell";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Badge, Button } from "@/components/ui";
import { labOptionalText } from "@/forms/lab.form";
import { statusColor } from "@/lib/status-colors";
import { labService } from "@/services/lab.service";
import { toBadgeTone } from "./shared";

export function SampleArchiveSection() {
  const { t } = useTranslation("lab");
  const canManage = useHasPermission(P.LAB.SAMPLES_MANAGE);
  const queryClient = useQueryClient();
  const [formOpen, formHandlers] = useDisclosure(false);
  const archiveDefaults: LabSampleArchiveFormInput = {
    order_id: "",
    patient_id: "",
    sample_barcode: "",
    storage_location: "",
    notes: "",
  };
  const {
    control,
    register,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm<LabSampleArchiveFormInput>({
    resolver: zodResolver(labSampleArchiveFormSchema),
    defaultValues: archiveDefaults,
  });

  const { data: archives = [], isLoading } = useQuery({
    queryKey: ["lab-sample-archive"],
    queryFn: () => labService.listSampleArchive(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateSampleArchiveRequest) => labService.createSampleArchive(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["lab-sample-archive"] });
      formHandlers.close();
      reset(archiveDefaults);
    },
  });

  const handleCreateSampleArchive = (values: LabSampleArchiveFormInput) => {
    createMutation.mutate({
      order_id: labOptionalText(values.order_id),
      patient_id: labOptionalText(values.patient_id),
      sample_barcode: labOptionalText(values.sample_barcode),
      storage_location: labOptionalText(values.storage_location),
      notes: labOptionalText(values.notes),
    });
  };

  const retrieveMutation = useMutation({
    mutationFn: (id: string) => labService.retrieveSampleArchive(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["lab-sample-archive"] }),
  });

  const columns = [
    {
      key: "sample_barcode",
      label: "Barcode",
      render: (row: LabSampleArchive) => <Text fw={500}>{row.sample_barcode ?? "—"}</Text>,
    },
    {
      key: "patient_id",
      label: "Patient",
      render: (row: LabSampleArchive) => (
        <PatientNameCell patientId={row.patient_id} showUhid={false} />
      ),
    },
    {
      key: "storage_location",
      label: "Location",
      render: (row: LabSampleArchive) => <Text size="sm">{row.storage_location ?? "—"}</Text>,
    },
    {
      key: "status",
      label: "Status",
      render: (row: LabSampleArchive) => (
        <Badge tone={toBadgeTone(statusColor(row.status))} size="sm">
          {row.status}
        </Badge>
      ),
    },
    {
      key: "stored_at",
      label: "Stored",
      render: (row: LabSampleArchive) => (
        <Text size="sm">{row.stored_at ? new Date(row.stored_at).toLocaleDateString() : "—"}</Text>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (row: LabSampleArchive) =>
        canManage && row.status === "stored" ? (
          <Button tone="secondary" size="xs" onClick={() => retrieveMutation.mutate(row.id)}>
            {t("retrieve")}
          </Button>
        ) : (
          <Text size="sm" c="dimmed">
            —
          </Text>
        ),
    },
  ];

  return (
    <Stack>
      {canManage && (
        <Group>
          <Button
            tone="primary"
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={() => {
              formHandlers.toggle();
              if (formOpen) reset(archiveDefaults);
            }}
          >
            {t("archiveSample")}
          </Button>
        </Group>
      )}
      {formOpen && (
        <Stack component="form" gap="xs" onSubmit={handleSubmit(handleCreateSampleArchive)}>
          <Group grow>
            <TextInput
              label={t("label.sampleBarcode")}
              error={errors.sample_barcode?.message}
              {...register("sample_barcode")}
            />
            <Controller
              control={control}
              name="patient_id"
              render={({ field }) => (
                <PatientSearchSelect
                  value={field.value}
                  onChange={(id) => field.onChange(id)}
                  error={errors.patient_id?.message}
                />
              )}
            />
            <TextInput
              label={t("label.storageLocation")}
              error={errors.storage_location?.message}
              {...register("storage_location")}
            />
          </Group>
          <Group grow>
            <TextInput
              label={t("label.orderId")}
              error={errors.order_id?.message}
              {...register("order_id")}
            />
            <Textarea label={t("notes")} error={errors.notes?.message} {...register("notes")} />
          </Group>
          <Button tone="primary" size="xs" type="submit" loading={createMutation.isPending}>
            Save
          </Button>
        </Stack>
      )}
      <DataTable columns={columns} data={archives} loading={isLoading} rowKey={(row) => row.id} />
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  QC Phase 3 Sections (EQAS, Proficiency, NABL, Consumption)
// ══════════════════════════════════════════════════════════
