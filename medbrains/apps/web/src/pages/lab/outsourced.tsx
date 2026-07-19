// Lab OutsourcedTab — split from lab.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import { Group, NumberInput, Stack, Text, Textarea, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { LabOutsourcedOrderFormInput } from "@medbrains/schemas";
import { labOutsourcedOrderFormSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type { CreateOutsourcedOrderRequest, LabOutsourcedOrder } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { DataTable } from "@/components";
import { Badge, Button } from "@/components/ui";
import { labOptionalNumber, labOptionalText } from "@/forms/lab.form";
import { statusColor } from "@/lib/status-colors";
import { labService } from "@/services/lab.service";
import { toBadgeTone } from "./shared";

export function OutsourcedTab() {
  const { t } = useTranslation("lab");
  const canManage = useHasPermission(P.LAB.OUTSOURCED_MANAGE);
  const queryClient = useQueryClient();
  const [formOpen, formHandlers] = useDisclosure(false);
  const outsourcedDefaults: LabOutsourcedOrderFormInput = {
    order_id: "",
    external_lab_name: "",
    external_lab_code: "",
    sent_date: "",
    expected_return_date: "",
    cost: "",
    notes: "",
  };
  const {
    control,
    register,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm<LabOutsourcedOrderFormInput>({
    resolver: zodResolver(labOutsourcedOrderFormSchema),
    defaultValues: outsourcedDefaults,
  });

  const { data: outsourced = [], isLoading } = useQuery({
    queryKey: ["lab-outsourced"],
    queryFn: () => labService.listOutsourcedOrders(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateOutsourcedOrderRequest) => labService.createOutsourcedOrder(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["lab-outsourced"] });
      formHandlers.close();
      reset(outsourcedDefaults);
    },
  });

  const handleCreateOutsourcedOrder = (values: LabOutsourcedOrderFormInput) => {
    createMutation.mutate({
      order_id: values.order_id.trim(),
      external_lab_name: values.external_lab_name.trim(),
      external_lab_code: labOptionalText(values.external_lab_code),
      sent_date: labOptionalText(values.sent_date),
      expected_return_date: labOptionalText(values.expected_return_date),
      cost: labOptionalNumber(values.cost),
      notes: labOptionalText(values.notes),
    });
  };

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      labService.updateOutsourcedOrder(id, {
        status: status as "pending_send" | "sent" | "result_received" | "cancelled",
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["lab-outsourced"] }),
  });

  const columns = [
    {
      key: "order_id",
      label: "Order",
      render: (row: LabOutsourcedOrder) => <Text size="sm">{row.order_id.slice(0, 8)}...</Text>,
    },
    {
      key: "external_lab_name",
      label: "External Lab",
      render: (row: LabOutsourcedOrder) => <Text fw={500}>{row.external_lab_name}</Text>,
    },
    {
      key: "status",
      label: "Status",
      render: (row: LabOutsourcedOrder) => (
        <Badge tone={toBadgeTone(statusColor(row.status))} size="sm">
          {row.status.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      key: "sent_date",
      label: "Sent",
      render: (row: LabOutsourcedOrder) => <Text size="sm">{row.sent_date ?? "—"}</Text>,
    },
    {
      key: "expected_return_date",
      label: "Expected",
      render: (row: LabOutsourcedOrder) => <Text size="sm">{row.expected_return_date ?? "—"}</Text>,
    },
    {
      key: "cost",
      label: "Cost",
      render: (row: LabOutsourcedOrder) => <Text size="sm">{row.cost ? `₹${row.cost}` : "—"}</Text>,
    },
    {
      key: "actions",
      label: "Actions",
      render: (row: LabOutsourcedOrder) =>
        canManage ? (
          <Group gap="xs">
            {row.status === "pending_send" && (
              <Button
                tone="secondary"
                size="xs"
                onClick={() => updateMutation.mutate({ id: row.id, status: "sent" })}
              >
                Mark Sent
              </Button>
            )}
            {row.status === "sent" && (
              <Button
                tone="secondary"
                size="xs"
                onClick={() => updateMutation.mutate({ id: row.id, status: "result_received" })}
              >
                Result Received
              </Button>
            )}
          </Group>
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
              if (formOpen) reset(outsourcedDefaults);
            }}
          >
            {t("outsourceOrder")}
          </Button>
        </Group>
      )}
      {formOpen && (
        <Stack component="form" gap="xs" onSubmit={handleSubmit(handleCreateOutsourcedOrder)}>
          <Group grow>
            <TextInput
              label={t("label.orderId")}
              required
              error={errors.order_id?.message}
              {...register("order_id")}
            />
            <TextInput
              label={t("label.externalLabName")}
              required
              error={errors.external_lab_name?.message}
              {...register("external_lab_name")}
            />
          </Group>
          <Group grow>
            <TextInput
              label={t("label.labCode")}
              error={errors.external_lab_code?.message}
              {...register("external_lab_code")}
            />
            <TextInput
              label={t("label.sentDate")}
              type="date"
              error={errors.sent_date?.message}
              {...register("sent_date")}
            />
            <TextInput
              label={t("label.expectedReturn")}
              type="date"
              error={errors.expected_return_date?.message}
              {...register("expected_return_date")}
            />
          </Group>
          <Controller
            control={control}
            name="cost"
            render={({ field }) => (
              <NumberInput
                label={t("label.cost")}
                min={0}
                decimalScale={2}
                value={field.value}
                onChange={field.onChange}
                error={errors.cost?.message}
                w={200}
              />
            )}
          />
          <Textarea label={t("notes")} error={errors.notes?.message} {...register("notes")} />
          <Button tone="primary" size="xs" type="submit" loading={createMutation.isPending}>
            Save
          </Button>
        </Stack>
      )}
      <DataTable columns={columns} data={outsourced} loading={isLoading} rowKey={(row) => row.id} />
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Sample Management Tab (Phase 3)
// ══════════════════════════════════════════════════════════
