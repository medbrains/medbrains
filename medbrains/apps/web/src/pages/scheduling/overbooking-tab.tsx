// Scheduling OverbookingTab — split from scheduling.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import { Drawer, Group, NumberInput, Select, Stack, Switch, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { SchedulingOverbookingRuleFormInput } from "@medbrains/schemas";
import { schedulingOverbookingRuleFormSchema } from "@medbrains/schemas";
import type {
  CreateOverbookingRuleRequest,
  SchedulingOverbookingRule,
  UpdateOverbookingRuleRequest,
} from "@medbrains/types";
import { IconPencil, IconPlus, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { DataTable } from "@/components";
import type { Column } from "@/components/DataTable";
import { DepartmentSelect } from "@/components/DepartmentSelect";
import { DoctorSearchSelect } from "@/components/DoctorSearchSelect";
import { Badge, Button, IconButton, toast } from "@/components/ui";
import { schedulingInteger, schedulingNumber } from "@/forms/scheduling.form";
import { confirmDestructive } from "@/lib/confirm";
import { schedulingService } from "@/services/scheduling.service";
import { DAY_NAMES, formatPercent, truncateId } from "./shared";

const emptyOverbookingForm: SchedulingOverbookingRuleFormInput = {
  doctor_id: "",
  department_id: "",
  day_of_week: 1,
  max_overbook_slots: 2,
  overbook_threshold_probability: 0.3,
  is_active: true,
};

export function OverbookingTab({ canManage }: { canManage: boolean }) {
  const qc = useQueryClient();
  const [opened, { open, close }] = useDisclosure(false);
  const [editing, setEditing] = useState<SchedulingOverbookingRule | null>(null);
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SchedulingOverbookingRuleFormInput>({
    resolver: zodResolver(schedulingOverbookingRuleFormSchema),
    defaultValues: emptyOverbookingForm,
  });

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ["scheduling-overbooking-rules"],
    queryFn: () => schedulingService.listOverbookingRules(),
  });

  const createMut = useMutation({
    mutationFn: (d: CreateOverbookingRuleRequest) => schedulingService.createOverbookingRule(d),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["scheduling-overbooking-rules"] });
      close();
      reset(emptyOverbookingForm);
      toast.success("Overbooking rule created", { title: "Created" });
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateOverbookingRuleRequest }) =>
      schedulingService.updateOverbookingRule(id, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["scheduling-overbooking-rules"] });
      close();
      setEditing(null);
      reset(emptyOverbookingForm);
      toast.success("Overbooking rule updated", { title: "Updated" });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => schedulingService.deleteOverbookingRule(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["scheduling-overbooking-rules"] });
      toast.error("Overbooking rule removed", { title: "Deleted" });
    },
  });

  function openEdit(rule: SchedulingOverbookingRule) {
    setEditing(rule);
    reset({
      doctor_id: rule.doctor_id,
      department_id: rule.department_id,
      day_of_week: rule.day_of_week,
      max_overbook_slots: rule.max_overbook_slots,
      overbook_threshold_probability: rule.overbook_threshold_probability,
      is_active: rule.is_active,
    });
    open();
  }

  function handleSave(values: SchedulingOverbookingRuleFormInput) {
    const dayNum = schedulingInteger(values.day_of_week, 1);
    const maxSlots = schedulingInteger(values.max_overbook_slots, 2);
    const threshold = schedulingNumber(values.overbook_threshold_probability, 0.3);
    if (editing) {
      updateMut.mutate({
        id: editing.id,
        data: {
          max_overbook_slots: maxSlots,
          overbook_threshold_probability: threshold,
          is_active: values.is_active,
        },
      });
    } else {
      createMut.mutate({
        doctor_id: values.doctor_id,
        department_id: values.department_id,
        day_of_week: dayNum,
        max_overbook_slots: maxSlots,
        overbook_threshold_probability: threshold,
      });
    }
  }

  const columns: Column<SchedulingOverbookingRule>[] = [
    {
      key: "doctor_id",
      label: "Doctor",
      render: (r) => (
        <Text size="sm" ff="monospace">
          {truncateId(r.doctor_id)}
        </Text>
      ),
    },
    {
      key: "department_id",
      label: "Department",
      render: (r) => (
        <Text size="sm" ff="monospace">
          {truncateId(r.department_id)}
        </Text>
      ),
    },
    {
      key: "day_of_week",
      label: "Day",
      render: (r) => <Text size="sm">{DAY_NAMES[r.day_of_week] ?? `Day ${r.day_of_week}`}</Text>,
    },
    {
      key: "max_overbook_slots",
      label: "Max Overbook",
      render: (r) => <Text size="sm">{r.max_overbook_slots}</Text>,
    },
    {
      key: "overbook_threshold_probability",
      label: "Threshold",
      render: (r) => <Text size="sm">{formatPercent(r.overbook_threshold_probability)}</Text>,
    },
    {
      key: "is_active",
      label: "Active",
      render: (r) => (
        <Badge tone={r.is_active ? "success" : "danger"} size="sm">
          {r.is_active ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    ...(canManage
      ? [
          {
            key: "actions",
            label: "Actions",
            render: (r: SchedulingOverbookingRule) => (
              <Group gap="xs" wrap="nowrap">
                <IconButton tone="primary" size="sm" onClick={() => openEdit(r)} aria-label="Edit">
                  <IconPencil size={14} />
                </IconButton>
                <IconButton
                  tone="danger"
                  size="sm"
                  onClick={() =>
                    confirmDestructive({
                      title: "Delete",
                      message: "Permanently delete this record? This cannot be undone.",
                      onConfirm: () => deleteMut.mutate(r.id),
                    })
                  }
                  loading={deleteMut.isPending}
                  aria-label="Delete"
                >
                  <IconTrash size={14} />
                </IconButton>
              </Group>
            ),
          },
        ]
      : []),
  ];

  return (
    <Stack gap="md">
      <Group justify="flex-end">
        {canManage && (
          <Button
            tone="primary"
            leftSection={<IconPlus size={16} />}
            onClick={() => {
              setEditing(null);
              reset(emptyOverbookingForm);
              open();
            }}
          >
            Add Rule
          </Button>
        )}
      </Group>
      <DataTable<SchedulingOverbookingRule>
        columns={columns}
        data={rules}
        loading={isLoading}
        rowKey={(r) => r.id}
        emptyTitle="No overbooking rules"
        emptyDescription="Configure overbooking rules per doctor, department, and day"
      />

      <Drawer
        opened={opened}
        onClose={() => {
          close();
          setEditing(null);
          reset(emptyOverbookingForm);
        }}
        title={editing ? "Edit Overbooking Rule" : "Create Overbooking Rule"}
        position="right"
        size="md"
      >
        <Stack component="form" gap="md" onSubmit={handleSubmit(handleSave)}>
          <Controller
            name="doctor_id"
            control={control}
            render={({ field }) => (
              <DoctorSearchSelect
                label="Doctor"
                required
                disabled={!!editing}
                value={field.value}
                onChange={field.onChange}
                error={errors.doctor_id?.message}
              />
            )}
          />
          <Controller
            name="department_id"
            control={control}
            render={({ field }) => (
              <DepartmentSelect
                label="Department"
                required
                disabled={!!editing}
                value={field.value}
                onChange={field.onChange}
                error={errors.department_id?.message}
              />
            )}
          />
          <Controller
            name="day_of_week"
            control={control}
            render={({ field }) => (
              <Select
                label="Day of Week"
                data={DAY_NAMES.map((name, i) => ({ value: String(i), label: name }))}
                value={String(field.value)}
                onChange={(value) => field.onChange(Number(value ?? 1))}
                required
                disabled={!!editing}
                error={errors.day_of_week?.message}
              />
            )}
          />
          <Controller
            name="max_overbook_slots"
            control={control}
            render={({ field }) => (
              <NumberInput
                label="Max Overbook Slots"
                value={field.value}
                onChange={field.onChange}
                min={1}
                max={20}
                error={errors.max_overbook_slots?.message}
              />
            )}
          />
          <Controller
            name="overbook_threshold_probability"
            control={control}
            render={({ field }) => (
              <NumberInput
                label="Overbook Threshold Probability"
                value={field.value}
                onChange={field.onChange}
                min={0}
                max={1}
                step={0.01}
                decimalScale={2}
                error={errors.overbook_threshold_probability?.message}
              />
            )}
          />
          {editing && (
            <Controller
              name="is_active"
              control={control}
              render={({ field }) => (
                <Switch
                  label="Active"
                  checked={field.value}
                  onChange={(event) => field.onChange(event.currentTarget.checked)}
                />
              )}
            />
          )}
          <Button tone="primary" type="submit" loading={createMut.isPending || updateMut.isPending}>
            {editing ? "Update Rule" : "Create Rule"}
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Tab — Conflicts
// ══════════════════════════════════════════════════════════
