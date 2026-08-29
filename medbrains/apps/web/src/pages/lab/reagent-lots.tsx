// Lab ReagentLotsSection — split from lab.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import { Group, NumberInput, Stack, Text, Textarea, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { LabReagentLotFormInput } from "@medbrains/schemas";
import { labReagentLotFormSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type {
  CreateReagentLotRequest,
  LabReagentLot,
  UpdateReagentLotRequest,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconCheck, IconPencil, IconPlus, IconX } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { DataTable } from "@/components";
import { LabTestSearchSelect } from "@/components/LabTestSearchSelect";
import { Badge, Button, IconButton } from "@/components/ui";
import { labOptionalNumber, labOptionalText } from "@/forms/lab.form";
import { labService } from "@/services/lab.service";

export function ReagentLotsSection() {
  const { t } = useTranslation("lab");
  const canCreate = useHasPermission(P.LAB.QC_CREATE);
  // Correcting a lot is `lab.qc.manage`, a different code from creating one.
  const canManage = useHasPermission(P.LAB.QC_MANAGE);
  const queryClient = useQueryClient();
  const [formOpen, formHandlers] = useDisclosure(false);
  const reagentLotDefaults: LabReagentLotFormInput = {
    reagent_name: "",
    lot_number: "",
    manufacturer: "",
    test_id: "",
    received_date: "",
    expiry_date: "",
    quantity: "",
    quantity_unit: "",
    notes: "",
  };
  const {
    control,
    register,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm<LabReagentLotFormInput>({
    resolver: zodResolver(labReagentLotFormSchema),
    defaultValues: reagentLotDefaults,
  });

  const { data: lots = [], isLoading } = useQuery({
    queryKey: ["lab-reagent-lots"],
    queryFn: () => labService.listReagentLots(),
  });

  // A reagent lot could be recorded and never corrected: `updateReagentLot`
  // existed in the client with no caller and there is no delete route. A lot
  // entered with the wrong expiry date stays wrong, and every QC run and every
  // patient result attributed to it inherits that.
  const [editing, setEditing] = useState<LabReagentLot | null>(null);

  const closeForm = () => {
    formHandlers.close();
    setEditing(null);
    reset(reagentLotDefaults);
  };

  const saveMutation = useMutation({
    mutationFn: (data: CreateReagentLotRequest) => {
      if (!editing) return labService.createReagentLot(data);
      // The update accepts eight fields and not `lot_number` or
      // `received_date`: the lot number identifies the vial and the received
      // date is a fact about when it arrived, neither of which an edit should
      // rewrite. Sending only what the server will act on.
      const patch: UpdateReagentLotRequest = {
        reagent_name: data.reagent_name,
        manufacturer: data.manufacturer,
        test_id: data.test_id,
        expiry_date: data.expiry_date,
        quantity: data.quantity,
        quantity_unit: data.quantity_unit,
        notes: data.notes,
      };
      return labService.updateReagentLot(editing.id, patch);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["lab-reagent-lots"] });
      closeForm();
    },
  });

  const openEdit = (row: LabReagentLot) => {
    setEditing(row);
    reset({
      reagent_name: row.reagent_name,
      lot_number: row.lot_number,
      manufacturer: row.manufacturer ?? "",
      test_id: row.test_id ?? "",
      received_date: row.received_date ?? "",
      expiry_date: row.expiry_date ?? "",
      quantity: row.quantity ?? "",
      quantity_unit: row.quantity_unit ?? "",
      notes: row.notes ?? "",
    });
    formHandlers.open();
  };

  const handleCreateReagentLot = (values: LabReagentLotFormInput) => {
    saveMutation.mutate({
      reagent_name: values.reagent_name.trim(),
      lot_number: values.lot_number.trim(),
      manufacturer: labOptionalText(values.manufacturer),
      test_id: labOptionalText(values.test_id),
      received_date: labOptionalText(values.received_date),
      expiry_date: labOptionalText(values.expiry_date),
      quantity: labOptionalNumber(values.quantity),
      quantity_unit: labOptionalText(values.quantity_unit),
      notes: labOptionalText(values.notes),
    });
  };

  const columns = [
    {
      key: "reagent_name",
      label: "Reagent",
      render: (row: LabReagentLot) => <Text fw={500}>{row.reagent_name}</Text>,
    },
    {
      key: "lot_number",
      label: "Lot #",
      render: (row: LabReagentLot) => <Text size="sm">{row.lot_number}</Text>,
    },
    {
      key: "manufacturer",
      label: "Manufacturer",
      render: (row: LabReagentLot) => <Text size="sm">{row.manufacturer ?? "—"}</Text>,
    },
    {
      key: "expiry_date",
      label: "Expiry",
      render: (row: LabReagentLot) => {
        if (!row.expiry_date) return <Text size="sm">—</Text>;
        const isExpired = new Date(row.expiry_date) < new Date();
        return (
          <Badge tone={isExpired ? "danger" : "success"} size="sm">
            {row.expiry_date}
          </Badge>
        );
      },
    },
    {
      key: "quantity",
      label: "Qty",
      render: (row: LabReagentLot) => (
        <Text size="sm">{row.quantity ? `${row.quantity} ${row.quantity_unit ?? ""}` : "—"}</Text>
      ),
    },
    {
      key: "is_active",
      label: "Active",
      render: (row: LabReagentLot) =>
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
            render: (row: LabReagentLot) => (
              <IconButton
                tone="default"
                aria-label={`Edit lot ${row.lot_number}`}
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
      {canCreate && (
        <Group>
          <Button
            tone="primary"
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={() => {
              if (formOpen) reset(reagentLotDefaults);
              if (formOpen) {
                closeForm();
                return;
              }
              setEditing(null);
              reset(reagentLotDefaults);
              formHandlers.open();
            }}
          >
            {t("addReagentLot")}
          </Button>
        </Group>
      )}
      {formOpen && (
        <Stack component="form" gap="xs" onSubmit={handleSubmit(handleCreateReagentLot)}>
          <Group grow>
            <TextInput
              label={t("label.reagentName")}
              required
              error={errors.reagent_name?.message}
              {...register("reagent_name")}
            />
            <TextInput
              label={t("label.lotNumber")}
              required
              // Shown but not editable: the lot number identifies the vial,
              // and the update endpoint does not accept it. A field that
              // looks editable and silently discards the change is worse
              // than one that says it cannot.
              disabled={editing !== null}
              description={editing ? "Fixed once the lot is recorded" : undefined}
              error={errors.lot_number?.message}
              {...register("lot_number")}
            />
          </Group>
          <Group grow>
            <TextInput
              label={t("label.manufacturer")}
              error={errors.manufacturer?.message}
              {...register("manufacturer")}
            />
            <Controller
              control={control}
              name="test_id"
              render={({ field }) => (
                <LabTestSearchSelect
                  value={field.value}
                  onChange={(id) => field.onChange(id)}
                  error={errors.test_id?.message}
                />
              )}
            />
          </Group>
          <Group grow>
            <TextInput
              label={t("label.receivedDate")}
              type="date"
              // A fact about when the vial arrived, not a setting.
              disabled={editing !== null}
              description={editing ? "Fixed once the lot is recorded" : undefined}
              error={errors.received_date?.message}
              {...register("received_date")}
            />
            <TextInput
              label={t("label.expiryDate")}
              type="date"
              error={errors.expiry_date?.message}
              {...register("expiry_date")}
            />
            <Controller
              control={control}
              name="quantity"
              render={({ field }) => (
                <NumberInput
                  label={t("label.quantity")}
                  min={0}
                  decimalScale={2}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.quantity?.message}
                />
              )}
            />
            <TextInput
              label={t("unit")}
              error={errors.quantity_unit?.message}
              {...register("quantity_unit")}
            />
          </Group>
          <Textarea label={t("notes")} error={errors.notes?.message} {...register("notes")} />
          <Button tone="primary" size="xs" type="submit" loading={saveMutation.isPending}>
            {editing ? "Save changes" : t("save")}
          </Button>
        </Stack>
      )}
      <DataTable columns={columns} data={lots} loading={isLoading} rowKey={(row) => row.id} />
    </Stack>
  );
}
