// Lab NablDocumentsSection — split from lab.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import { Group, Select, Stack, Switch, Text, Textarea, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { LabNablDocumentFormInput } from "@medbrains/schemas";
import { labNablDocumentFormSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type { CreateNablDocumentRequest, LabNablDocument } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconCheck, IconPlus, IconX } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { DataTable } from "@/components";
import { Badge, Button } from "@/components/ui";
import { labNablDocumentTypeOptions, labOptionalText } from "@/forms/lab.form";
import { labService } from "@/services/lab.service";

export function NablDocumentsSection() {
  const { t } = useTranslation("lab");
  const canManage = useHasPermission(P.LAB.QC_MANAGE);
  const queryClient = useQueryClient();
  const [formOpen, formHandlers] = useDisclosure(false);
  const nablDocumentDefaults: LabNablDocumentFormInput = {
    document_type: "",
    document_number: "",
    title: "",
    version: "",
    effective_date: "",
    review_date: "",
    file_path: "",
    is_current: true,
    notes: "",
  };
  const {
    control,
    register,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm<LabNablDocumentFormInput>({
    resolver: zodResolver(labNablDocumentFormSchema),
    defaultValues: nablDocumentDefaults,
  });

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["lab-nabl-documents"],
    queryFn: () => labService.listNablDocuments(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateNablDocumentRequest) => labService.createNablDocument(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["lab-nabl-documents"] });
      formHandlers.close();
      reset(nablDocumentDefaults);
    },
  });

  const handleCreateNablDocument = (values: LabNablDocumentFormInput) => {
    createMutation.mutate({
      document_type: labOptionalText(values.document_type),
      document_number: values.document_number.trim(),
      title: values.title.trim(),
      version: labOptionalText(values.version),
      effective_date: labOptionalText(values.effective_date),
      review_date: labOptionalText(values.review_date),
      file_path: labOptionalText(values.file_path),
      is_current: values.is_current,
      notes: labOptionalText(values.notes),
    });
  };

  const columns = [
    {
      key: "document_number",
      label: "Doc #",
      render: (row: LabNablDocument) => <Text fw={500}>{row.document_number}</Text>,
    },
    {
      key: "title",
      label: "Title",
      render: (row: LabNablDocument) => <Text size="sm">{row.title}</Text>,
    },
    {
      key: "document_type",
      label: "Type",
      render: (row: LabNablDocument) => <Text size="sm">{row.document_type ?? "—"}</Text>,
    },
    {
      key: "version",
      label: "Version",
      render: (row: LabNablDocument) => <Badge size="sm">{row.version ?? "—"}</Badge>,
    },
    {
      key: "effective_date",
      label: "Effective",
      render: (row: LabNablDocument) => <Text size="sm">{row.effective_date ?? "—"}</Text>,
    },
    {
      key: "review_date",
      label: "Review",
      render: (row: LabNablDocument) => <Text size="sm">{row.review_date ?? "—"}</Text>,
    },
    {
      key: "is_current",
      label: "Current",
      render: (row: LabNablDocument) =>
        row.is_current ? (
          <IconCheck size={14} color="success" />
        ) : (
          <IconX size={14} color="danger" />
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
              if (formOpen) reset(nablDocumentDefaults);
            }}
          >
            {t("addDocument")}
          </Button>
        </Group>
      )}
      {formOpen && (
        <Stack component="form" gap="xs" onSubmit={handleSubmit(handleCreateNablDocument)}>
          <Group grow>
            <TextInput
              label={t("label.documentNumber")}
              required
              error={errors.document_number?.message}
              {...register("document_number")}
            />
            <TextInput
              label={t("label.title")}
              required
              error={errors.title?.message}
              {...register("title")}
            />
            <Controller
              control={control}
              name="document_type"
              render={({ field }) => (
                <Select
                  label={t("label.type")}
                  data={labNablDocumentTypeOptions}
                  placeholder={t("placeholder.selectType")}
                  value={field.value || null}
                  onChange={(value) => field.onChange(value ?? "")}
                  error={errors.document_type?.message}
                  clearable
                  searchable
                />
              )}
            />
          </Group>
          <Group grow>
            <TextInput
              label={t("label.version")}
              error={errors.version?.message}
              {...register("version")}
            />
            <TextInput
              label={t("label.effectiveDate")}
              type="date"
              error={errors.effective_date?.message}
              {...register("effective_date")}
            />
            <TextInput
              label={t("label.reviewDate")}
              type="date"
              error={errors.review_date?.message}
              {...register("review_date")}
            />
          </Group>
          <Group grow align="flex-end">
            <TextInput
              label={t("label.filePath")}
              error={errors.file_path?.message}
              {...register("file_path")}
            />
            <Controller
              control={control}
              name="is_current"
              render={({ field }) => (
                <Switch
                  label={t("label.current")}
                  checked={field.value}
                  onChange={(event) => field.onChange(event.currentTarget.checked)}
                  error={errors.is_current?.message}
                />
              )}
            />
          </Group>
          <Textarea label={t("notes")} error={errors.notes?.message} {...register("notes")} />
          <Button tone="primary" size="xs" type="submit" loading={createMutation.isPending}>
            Save
          </Button>
        </Stack>
      )}
      <DataTable columns={columns} data={docs} loading={isLoading} rowKey={(row) => row.id} />
    </Stack>
  );
}
