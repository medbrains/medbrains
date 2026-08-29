// Lab CollectionCentersSection — split from lab.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import { Group, Select, Stack, Text, Textarea, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { LabCollectionCenterFormInput } from "@medbrains/schemas";
import { labCollectionCenterFormSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type {
  CreateCollectionCenterRequest,
  LabCollectionCenter,
  UpdateCollectionCenterRequest,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconCheck, IconPencil, IconPlus, IconX } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { DataTable } from "@/components";
import { Badge, Button, IconButton } from "@/components/ui";
import { labCollectionCenterTypeOptions, labOptionalText } from "@/forms/lab.form";
import { labService } from "@/services/lab.service";

export function CollectionCentersSection() {
  const { t } = useTranslation("lab");
  const canManage = useHasPermission(P.LAB.SAMPLES_MANAGE);
  const queryClient = useQueryClient();
  const [formOpen, formHandlers] = useDisclosure(false);
  const centerDefaults: LabCollectionCenterFormInput = {
    code: "",
    name: "",
    center_type: "hospital",
    address: "",
    city: "",
    phone: "",
    contact_person: "",
    notes: "",
  };
  const {
    control,
    register,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm<LabCollectionCenterFormInput>({
    resolver: zodResolver(labCollectionCenterFormSchema),
    defaultValues: centerDefaults,
  });

  const { data: centers = [], isLoading } = useQuery({
    queryKey: ["lab-collection-centers"],
    queryFn: () => labService.listCollectionCenters(),
  });

  // A collection centre whose phone number or address is wrong sends a phlebotomist to the wrong place.
  // `updateCollectionCenter` existed in the client with no caller and there is
  // no delete route, so a wrong value stayed wrong.
  const [editing, setEditing] = useState<LabCollectionCenter | null>(null);

  const closeForm = () => {
    formHandlers.close();
    setEditing(null);
    reset(centerDefaults);
  };

  const openEdit = (row: LabCollectionCenter) => {
    setEditing(row);
    reset({
      code: row.code,
      name: row.name,
      center_type: row.center_type as LabCollectionCenterFormInput["center_type"],
      address: row.address ?? "",
      city: row.city ?? "",
      phone: row.phone ?? "",
      contact_person: row.contact_person ?? "",
      notes: row.notes ?? "",
    });
    formHandlers.open();
  };

  const createMutation = useMutation({
    mutationFn: (data: CreateCollectionCenterRequest) => {
      if (!editing) return labService.createCollectionCenter(data);
      // Only what the update endpoint accepts: code identifies
      // the record and is not among its fields.
      const patch: UpdateCollectionCenterRequest = {
        name: data.name,
        center_type: data.center_type,
        address: data.address,
        city: data.city,
        phone: data.phone,
        contact_person: data.contact_person,
        notes: data.notes,
      };
      return labService.updateCollectionCenter(editing.id, patch);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["lab-collection-centers"] });
      closeForm();
    },
  });

  const handleCreateCollectionCenter = (values: LabCollectionCenterFormInput) => {
    createMutation.mutate({
      code: values.code.trim(),
      name: values.name.trim(),
      center_type: values.center_type,
      address: labOptionalText(values.address),
      city: labOptionalText(values.city),
      phone: labOptionalText(values.phone),
      contact_person: labOptionalText(values.contact_person),
      notes: labOptionalText(values.notes),
    });
  };

  const columns = [
    {
      key: "code",
      label: "Code",
      render: (row: LabCollectionCenter) => <Text fw={500}>{row.code}</Text>,
    },
    {
      key: "name",
      label: "Name",
      render: (row: LabCollectionCenter) => <Text size="sm">{row.name}</Text>,
    },
    {
      key: "center_type",
      label: "Type",
      render: (row: LabCollectionCenter) => <Badge size="sm">{row.center_type}</Badge>,
    },
    {
      key: "city",
      label: "City",
      render: (row: LabCollectionCenter) => <Text size="sm">{row.city ?? "—"}</Text>,
    },
    {
      key: "contact_person",
      label: "Contact",
      render: (row: LabCollectionCenter) => <Text size="sm">{row.contact_person ?? "—"}</Text>,
    },
    {
      key: "is_active",
      label: "Active",
      render: (row: LabCollectionCenter) =>
        row.is_active ? (
          <IconCheck size={14} color="success" />
        ) : (
          <IconX size={14} color="danger" />
        ),
    },
    ...(canManage
      ? [
          {
            key: "actions",
            label: "",
            render: (row: LabCollectionCenter) => (
              <IconButton
                tone="default"
                aria-label={`Edit ${row.name}`}
                onClick={() => openEdit(row)}
              >
                <IconPencil size={14} />
              </IconButton>
            ),
          },
        ]
      : []),
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
              if (formOpen) reset(centerDefaults);
            }}
          >
            {t("addCenter")}
          </Button>
        </Group>
      )}
      {formOpen && (
        <Stack component="form" gap="xs" onSubmit={handleSubmit(handleCreateCollectionCenter)}>
          <Group grow>
            <TextInput
              label={t("label.code")}
              required
              // The code identifies the record and the update endpoint does
              // not accept it. Shown and locked rather than looking editable
              // and silently discarding the change.
              disabled={editing !== null}
              description={editing ? "Fixed once created" : undefined}
              error={errors.code?.message}
              {...register("code")}
            />
            <TextInput
              label={t("label.name")}
              required
              error={errors.name?.message}
              {...register("name")}
            />
            <Controller
              control={control}
              name="center_type"
              render={({ field }) => (
                <Select
                  label={t("label.type")}
                  required
                  data={labCollectionCenterTypeOptions}
                  value={field.value}
                  onChange={(value) => field.onChange(value ?? "hospital")}
                  error={errors.center_type?.message}
                />
              )}
            />
          </Group>
          <Group grow>
            <TextInput label={t("label.city")} error={errors.city?.message} {...register("city")} />
            <TextInput
              label={t("label.phone")}
              error={errors.phone?.message}
              {...register("phone")}
            />
            <TextInput
              label={t("label.contactPerson")}
              error={errors.contact_person?.message}
              {...register("contact_person")}
            />
          </Group>
          <Textarea
            label={t("label.address")}
            error={errors.address?.message}
            {...register("address")}
          />
          <Textarea label={t("notes")} error={errors.notes?.message} {...register("notes")} />
          <Button tone="primary" size="xs" type="submit" loading={createMutation.isPending}>
            Save
          </Button>
        </Stack>
      )}
      <DataTable columns={columns} data={centers} loading={isLoading} rowKey={(row) => row.id} />
    </Stack>
  );
}
