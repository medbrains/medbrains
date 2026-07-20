// Utilization-review StatusTrackingTab — split from utilization-review.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import { Drawer, Select, Stack, Text, Textarea, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type { UrStatusConversionFormInput } from "@medbrains/schemas";
import { urStatusConversionFormSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type { UrStatusConversion } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { DataTable, PageHeader } from "@/components";
import type { Column } from "@/components/DataTable";
import { Badge, Button } from "@/components/ui";
import type { CreateUrConversionInput } from "@/services/utilizationReview.service";
import { utilizationReviewService } from "@/services/utilizationReview.service";
import { optionalTrimmed } from "./shared";

const EMPTY_CONVERSION_FORM: UrStatusConversionFormInput = {
  admission_id: "",
  from_status: "observation",
  to_status: "inpatient",
  reason: "",
};

function formToConversionPayload(form: UrStatusConversionFormInput): CreateUrConversionInput {
  return {
    admission_id: form.admission_id.trim(),
    from_status: form.from_status,
    to_status: form.to_status,
    reason: optionalTrimmed(form.reason),
  };
}

export function StatusTrackingTab() {
  const qc = useQueryClient();
  const canCreate = useHasPermission(P.UR.CONVERSIONS_CREATE);
  const [opened, { open, close }] = useDisclosure(false);
  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
    reset,
  } = useForm<UrStatusConversionFormInput>({
    resolver: zodResolver(urStatusConversionFormSchema),
    defaultValues: EMPTY_CONVERSION_FORM,
  });

  const { data = [], isLoading } = useQuery({
    queryKey: ["ur-conversions"],
    queryFn: () => utilizationReviewService.listConversions(),
  });

  const createMut = useMutation({
    mutationFn: (d: CreateUrConversionInput) => utilizationReviewService.createConversion(d),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["ur-conversions"] });
      notifications.show({
        title: "Conversion Created",
        message: "Status conversion recorded",
        color: "success",
      });
      reset(EMPTY_CONVERSION_FORM);
      close();
    },
    onError: () =>
      notifications.show({
        title: "Error",
        message: "Failed to create conversion",
        color: "danger",
      }),
  });

  const columns: Column<UrStatusConversion>[] = [
    {
      key: "admission_id",
      label: "Admission ID",
      render: (r) => <Text size="sm">{r.admission_id.slice(0, 8)}...</Text>,
    },
    {
      key: "from_status",
      label: "From Status",
      render: (r) => (
        <Badge tone="neutral" variant="outline">
          {r.from_status}
        </Badge>
      ),
    },
    {
      key: "to_status",
      label: "To Status",
      render: (r) => (
        <Badge tone="primary" variant="outline">
          {r.to_status}
        </Badge>
      ),
    },
    {
      key: "conversion_date",
      label: "Conversion Date",
      render: (r) => <Text size="sm">{new Date(r.conversion_date).toLocaleDateString()}</Text>,
    },
    {
      key: "reason",
      label: "Reason",
      render: (r) => (
        <Text size="sm" lineClamp={1}>
          {r.reason ?? "—"}
        </Text>
      ),
    },
  ];

  const openCreateConversion = () => {
    reset(EMPTY_CONVERSION_FORM);
    open();
  };

  const submitConversion = handleSubmit((values) => {
    createMut.mutate(formToConversionPayload(values));
  });

  return (
    <Stack gap="md">
      <PageHeader
        title="Status Tracking"
        subtitle="Observation to inpatient status conversions"
        actions={
          canCreate ? (
            <Button
              tone="primary"
              leftSection={<IconPlus size={16} />}
              onClick={openCreateConversion}
            >
              New Conversion
            </Button>
          ) : undefined
        }
      />

      <DataTable<UrStatusConversion>
        data={data}
        loading={isLoading}
        rowKey={(r) => r.id}
        columns={columns}
      />

      <Drawer
        opened={opened}
        onClose={close}
        title="Create Status Conversion"
        position="right"
        size="xl"
      >
        <Stack component="form" gap="sm" onSubmit={submitConversion}>
          <TextInput
            label="Admission ID"
            required
            error={errors.admission_id?.message}
            {...register("admission_id")}
          />
          <Controller
            name="from_status"
            control={control}
            render={({ field }) => (
              <Select
                label="From Status"
                required
                data={[
                  { value: "observation", label: "Observation" },
                  { value: "inpatient", label: "Inpatient" },
                ]}
                value={field.value}
                onChange={field.onChange}
                error={errors.from_status?.message}
              />
            )}
          />
          <Controller
            name="to_status"
            control={control}
            render={({ field }) => (
              <Select
                label="To Status"
                required
                data={[
                  { value: "observation", label: "Observation" },
                  { value: "inpatient", label: "Inpatient" },
                ]}
                value={field.value}
                onChange={field.onChange}
                error={errors.to_status?.message}
              />
            )}
          />
          <Textarea
            label="Reason"
            autosize
            minRows={3}
            error={errors.reason?.message}
            {...register("reason")}
          />
          <Button tone="primary" loading={createMut.isPending} type="submit">
            Create Conversion
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}
