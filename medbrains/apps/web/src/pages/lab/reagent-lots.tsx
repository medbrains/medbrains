// Lab ReagentLotsSection — split from lab.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import { Group, NumberInput, Stack, Text, Textarea, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { LabReagentLotFormInput } from "@medbrains/schemas";
import { labReagentLotFormSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type { CreateReagentLotRequest, LabReagentLot } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconCheck, IconPlus, IconX } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { DataTable } from "@/components";
import { LabTestSearchSelect } from "@/components/LabTestSearchSelect";
import { Badge, Button } from "@/components/ui";
import { labOptionalNumber, labOptionalText } from "@/forms/lab.form";
import { labService } from "@/services/lab.service";

export function ReagentLotsSection() {
  const { t } = useTranslation("lab");
  const canCreate = useHasPermission(P.LAB.QC_CREATE);
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

  const createMutation = useMutation({
    mutationFn: (data: CreateReagentLotRequest) => labService.createReagentLot(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["lab-reagent-lots"] });
      formHandlers.close();
      reset(reagentLotDefaults);
    },
  });

  const handleCreateReagentLot = (values: LabReagentLotFormInput) => {
    createMutation.mutate({
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
              formHandlers.toggle();
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
          <Button tone="primary" size="xs" type="submit" loading={createMutation.isPending}>
            {t("save")}
          </Button>
        </Stack>
      )}
      <DataTable columns={columns} data={lots} loading={isLoading} rowKey={(row) => row.id} />
    </Stack>
  );
}
