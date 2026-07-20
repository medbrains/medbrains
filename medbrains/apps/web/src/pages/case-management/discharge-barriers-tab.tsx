// Case-management DischargeBarriersTab — split from case-management.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import { Drawer, Group, Select, Stack, Text, Textarea, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type { DischargeBarrierFormInput } from "@medbrains/schemas";
import { dischargeBarrierFormSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type { CreateDischargeBarrierRequest, DischargeBarrier } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconCheck, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { DataTable } from "@/components";
import type { Column } from "@/components/DataTable";
import { Badge, Button, IconButton } from "@/components/ui";
import { dischargeBarrierTypeOptions } from "@/forms/case-management.form";
import { caseManagementService } from "@/services/case-management.service";
import { BARRIER_TYPE_COLORS, truncate } from "./shared";

export function DischargeBarriersTab() {
  const canManage = useHasPermission(P.CASE_MGMT.BARRIERS_MANAGE);
  const qc = useQueryClient();
  const [createOpen, createHandlers] = useDisclosure(false);

  const [filterAssignmentId, setFilterAssignmentId] = useState("");
  const [filterType, setFilterType] = useState<string | null>(null);
  const [filterResolved, setFilterResolved] = useState<string | null>("false");

  const { data: barriers = [], isLoading } = useQuery({
    queryKey: ["case-barriers", filterAssignmentId, filterType, filterResolved],
    queryFn: () =>
      caseManagementService.listDischargeBarriers({
        case_assignment_id: filterAssignmentId || undefined,
        barrier_type: filterType ?? undefined,
        is_resolved: filterResolved === "all" ? undefined : (filterResolved ?? undefined),
      }),
  });

  const barrierForm = useForm<DischargeBarrierFormInput>({
    resolver: zodResolver(dischargeBarrierFormSchema),
    defaultValues: {
      case_assignment_id: "",
      barrier_type: "insurance_auth",
      description: "",
    },
  });
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = barrierForm;

  const createMut = useMutation({
    mutationFn: (data: CreateDischargeBarrierRequest) =>
      caseManagementService.createDischargeBarrier(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["case-barriers"] });
      createHandlers.close();
      reset();
      notifications.show({
        title: "Barrier Added",
        message: "Discharge barrier recorded",
        color: "success",
      });
    },
  });

  const resolveMut = useMutation({
    mutationFn: (id: string) =>
      caseManagementService.updateDischargeBarrier(id, { is_resolved: true }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["case-barriers"] });
      notifications.show({
        title: "Resolved",
        message: "Barrier marked as resolved",
        color: "teal",
      });
    },
  });

  const submitBarrier = (values: DischargeBarrierFormInput) => {
    createMut.mutate({
      case_assignment_id: values.case_assignment_id.trim(),
      barrier_type: values.barrier_type,
      description: values.description.trim(),
    });
  };

  const columns: Column<DischargeBarrier>[] = [
    {
      key: "case_assignment_id",
      label: "Assignment",
      render: (r) => <Text size="sm">{truncate(r.case_assignment_id, 8)}</Text>,
    },
    {
      key: "barrier_type",
      label: "Barrier Type",
      render: (r) => (
        <Badge tone={BARRIER_TYPE_COLORS[r.barrier_type] ?? "neutral"} variant="filled" size="sm">
          {r.barrier_type.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      key: "description",
      label: "Description",
      render: (r) => <Text size="sm">{truncate(r.description, 50)}</Text>,
    },
    {
      key: "identified_date",
      label: "Identified",
      render: (r) => <Text size="sm">{r.identified_date}</Text>,
    },
    {
      key: "is_resolved",
      label: "Resolved",
      render: (r) =>
        r.is_resolved ? (
          <Badge tone="success" variant="filled" size="sm">
            Resolved
          </Badge>
        ) : (
          <Badge tone="danger" variant="filled" size="sm">
            Unresolved
          </Badge>
        ),
    },
    {
      key: "escalated_to",
      label: "Escalated To",
      render: (r) => <Text size="sm">{r.escalated_to ?? "\u2014"}</Text>,
    },
    {
      key: "actions",
      label: "",
      render: (r) =>
        canManage && !r.is_resolved ? (
          <IconButton
            tone="success"
            size="sm"
            onClick={() => resolveMut.mutate(r.id)}
            aria-label="Confirm"
          >
            <IconCheck size={14} />
          </IconButton>
        ) : null,
    },
  ];

  return (
    <>
      <Group mb="md" gap="sm">
        <TextInput
          placeholder="Filter by Assignment ID"
          value={filterAssignmentId}
          onChange={(e) => setFilterAssignmentId(e.currentTarget.value)}
          w={220}
        />
        <Select
          placeholder="Barrier Type"
          data={dischargeBarrierTypeOptions}
          value={filterType}
          onChange={setFilterType}
          clearable
          w={180}
        />
        <Select
          placeholder="Resolved"
          data={[
            { value: "all", label: "All" },
            { value: "true", label: "Resolved" },
            { value: "false", label: "Unresolved" },
          ]}
          value={filterResolved}
          onChange={setFilterResolved}
          w={150}
        />
        {canManage && (
          <Button
            tone="primary"
            leftSection={<IconPlus size={16} />}
            onClick={createHandlers.open}
            ml="auto"
          >
            Add Barrier
          </Button>
        )}
      </Group>

      <DataTable columns={columns} data={barriers} loading={isLoading} rowKey={(r) => r.id} />

      <Drawer
        opened={createOpen}
        onClose={createHandlers.close}
        title="Add Discharge Barrier"
        position="right"
        size="xl"
      >
        <Stack component="form" onSubmit={handleSubmit(submitBarrier)}>
          <Controller
            name="case_assignment_id"
            control={control}
            render={({ field }) => (
              <TextInput
                label="Case Assignment ID"
                required
                {...field}
                error={errors.case_assignment_id?.message}
              />
            )}
          />
          <Controller
            name="barrier_type"
            control={control}
            render={({ field }) => (
              <Select
                label="Barrier Type"
                required
                data={dischargeBarrierTypeOptions}
                value={field.value}
                onChange={(value) => field.onChange(value ?? "insurance_auth")}
                error={errors.barrier_type?.message}
              />
            )}
          />
          <Controller
            name="description"
            control={control}
            render={({ field }) => (
              <Textarea
                label="Description"
                required
                {...field}
                error={errors.description?.message}
              />
            )}
          />
          <Button tone="primary" type="submit" loading={createMut.isPending}>
            Add Barrier
          </Button>
        </Stack>
      </Drawer>
    </>
  );
}

// ══════════════════════════════════════════════════════════
//  Referrals Tab
// ══════════════════════════════════════════════════════════
