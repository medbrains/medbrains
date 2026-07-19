// CAMP CampsTab — split from camp.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Drawer,
  Group,
  NumberInput,
  Select,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type { CampCreateFormInput } from "@medbrains/schemas";
import { campCreateFormSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type { Camp, CreateCampRequest, DepartmentRow } from "@medbrains/types";
import { P } from "@medbrains/types";
import {
  IconCheck,
  IconPencil,
  IconPlayerPlay,
  IconPlus,
  IconUsers,
  IconX,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { DataTable, useClinicalEmit } from "@/components";
import type { Column } from "@/components/DataTable";
import { EmployeeSearchSelect } from "@/components/EmployeeSearchSelect";
import { Badge, Button, IconButton } from "@/components/ui";
import {
  campOptionalInteger,
  campOptionalNumber,
  campOptionalText,
  campTypeOptions,
} from "@/forms/camp.form";
import { campService } from "@/services/camp.service";
import { lookupsService } from "@/services/lookups.service";
import { CampDetail } from "./camp-detail";
import { CAMP_STATUS_COLORS } from "./shared";

export function CampsTab({ onWorkCamp }: { onWorkCamp: (campId: string) => void }) {
  const emit = useClinicalEmit();
  const canCreate = useHasPermission(P.CAMP.CREATE);
  const canUpdate = useHasPermission(P.CAMP.UPDATE);
  const qc = useQueryClient();
  const [createOpen, createHandlers] = useDisclosure(false);
  const [detailOpen, detailHandlers] = useDisclosure(false);
  const [selectedCamp, setSelectedCamp] = useState<Camp | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const campDefaults: CampCreateFormInput = {
    name: "",
    camp_type: "general_health",
    organizing_department_id: null,
    supporting_department_ids: [],
    coordinator_id: null,
    planned_doctor_ids: [],
    planned_staff_ids: [],
    external_people: [],
    service_lines: [],
    service_offerings: [],
    doctor_engagements: [],
    planned_medicines: [],
    planned_medicine_ids: [],
    planned_medicine_refs: [],
    camp_charge_mode: "free",
    department_charge_mode: "free",
    doctor_charge_mode: "free",
    medicine_charge_mode: "free",
    free_medicine_approval_required: true,
    service_policy_notes: "",
    budget_doctor_amount: "",
    budget_medicine_amount: "",
    budget_diagnostics_amount: "",
    budget_consumables_amount: "",
    budget_transport_amount: "",
    budget_food_amount: "",
    budget_other_amount: "",
    sponsor_covered_amount: "",
    patient_expected_collection: "",
    budget_notes: "",
    scheduled_date: "",
    start_time: "",
    end_time: "",
    venue_name: "",
    venue_address: "",
    venue_city: "",
    venue_state: "",
    venue_pincode: "",
    expected_participants: "",
    budget_allocated: "",
    is_free: true,
    logistics_notes: "",
  };
  const {
    control,
    register,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm<CampCreateFormInput>({
    resolver: zodResolver(campCreateFormSchema),
    defaultValues: campDefaults,
  });

  const { data: camps = [], isLoading } = useQuery({
    queryKey: ["camps", statusFilter],
    queryFn: () => campService.listCamps(statusFilter ? { status: statusFilter } : undefined),
  });
  const { data: departments = [] } = useQuery<DepartmentRow[]>({
    queryKey: ["departments"],
    queryFn: () => lookupsService.listDepartments(),
    staleTime: 600_000,
  });
  const departmentOptions = useMemo(
    () =>
      departments
        .filter((department) =>
          ["clinical", "para_clinical", "diagnostic"].includes(department.department_type),
        )
        .map((department) => ({ value: department.id, label: department.name })),
    [departments],
  );

  const createMut = useMutation({
    mutationFn: (data: CreateCampRequest) => campService.createCamp(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["camps"] });
      createHandlers.close();
      reset(campDefaults);
      notifications.show({
        title: "Camp Created",
        message: "Camp planned successfully",
        color: "success",
      });
    },
  });

  const handleCreateCamp = (values: CampCreateFormInput) => {
    createMut.mutate({
      name: values.name.trim(),
      camp_type: values.camp_type,
      organizing_department_id: values.organizing_department_id ?? undefined,
      coordinator_id: values.coordinator_id ?? undefined,
      scheduled_date: values.scheduled_date.trim(),
      start_time: campOptionalText(values.start_time),
      end_time: campOptionalText(values.end_time),
      venue_name: campOptionalText(values.venue_name),
      venue_address: campOptionalText(values.venue_address),
      venue_city: campOptionalText(values.venue_city),
      venue_state: campOptionalText(values.venue_state),
      venue_pincode: campOptionalText(values.venue_pincode),
      expected_participants: campOptionalInteger(values.expected_participants),
      budget_allocated: campOptionalNumber(values.budget_allocated),
      is_free: values.is_free,
      logistics_notes: campOptionalText(values.logistics_notes),
    });
  };

  const approveMut = useMutation({
    mutationFn: (id: string) => campService.approveCamp(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["camps"] });
      notifications.show({ title: "Approved", message: "Camp approved", color: "success" });
    },
  });

  const activateMut = useMutation({
    mutationFn: (id: string) => campService.activateCamp(id),
    onSuccess: (camp) => {
      emit("camp.started", {
        camp_code: camp.camp_code,
        camp_id: camp.id,
        camp_type: camp.camp_type,
        scheduled_date: camp.scheduled_date,
        source_record_id: camp.id,
        status: camp.status,
      });
      void qc.invalidateQueries({ queryKey: ["camps"] });
      notifications.show({ title: "Activated", message: "Camp is now active", color: "success" });
    },
  });

  const completeMut = useMutation({
    mutationFn: (id: string) => campService.completeCamp(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["camps"] });
      notifications.show({
        title: "Completed",
        message: "Camp marked as completed",
        color: "teal",
      });
    },
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => campService.cancelCamp(id, {}),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["camps"] });
      notifications.show({ title: "Cancelled", message: "Camp cancelled", color: "danger" });
    },
  });

  const columns: Column<Camp>[] = [
    {
      key: "camp_code",
      label: "Code",
      render: (r) => (
        <Text size="sm" fw={500}>
          {r.camp_code}
        </Text>
      ),
    },
    { key: "name", label: "Name", render: (r) => r.name },
    {
      key: "camp_type",
      label: "Type",
      render: (r) => (
        <Badge tone="neutral" variant="light" size="sm">
          {campTypeOptions.find((t) => t.value === r.camp_type)?.label ?? r.camp_type}
        </Badge>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <Badge tone={CAMP_STATUS_COLORS[r.status] ?? "neutral"} variant="filled" size="sm">
          {r.status}
        </Badge>
      ),
    },
    { key: "scheduled_date", label: "Date", render: (r) => r.scheduled_date },
    { key: "venue_city", label: "City", render: (r) => r.venue_city ?? "—" },
    {
      key: "expected_participants",
      label: "Expected",
      render: (r) => r.expected_participants?.toString() ?? "—",
    },
    {
      key: "actions",
      label: "",
      render: (r) => (
        <Group gap={4}>
          <Tooltip label="View Details">
            <IconButton
              size="sm"
              onClick={() => {
                setSelectedCamp(r);
                detailHandlers.open();
              }}
              aria-label="View Details"
            >
              <IconPencil size={14} />
            </IconButton>
          </Tooltip>
          {r.status === "active" && (
            <Tooltip label="Work in this camp" closeDelay={0} withinPortal={false}>
              <IconButton
                tone="success"
                size="sm"
                onClick={(event) => {
                  event.currentTarget.blur();
                  onWorkCamp(r.id);
                }}
                aria-label="Work in this camp"
              >
                <IconUsers size={14} />
              </IconButton>
            </Tooltip>
          )}
          {canUpdate && r.status === "planned" && (
            <Tooltip label="Approve">
              <IconButton
                tone="primary"
                size="sm"
                onClick={() => approveMut.mutate(r.id)}
                aria-label="Approve"
              >
                <IconCheck size={14} />
              </IconButton>
            </Tooltip>
          )}
          {canUpdate && (r.status === "approved" || r.status === "setup") && (
            <Tooltip label="Activate">
              <IconButton
                tone="success"
                size="sm"
                onClick={() => activateMut.mutate(r.id)}
                aria-label="Activate"
              >
                <IconPlayerPlay size={14} />
              </IconButton>
            </Tooltip>
          )}
          {canUpdate && r.status === "active" && (
            <Tooltip label="Complete">
              <IconButton
                tone="success"
                size="sm"
                onClick={() => completeMut.mutate(r.id)}
                aria-label="Complete"
              >
                <IconCheck size={14} />
              </IconButton>
            </Tooltip>
          )}
          {canUpdate && !["completed", "cancelled"].includes(r.status) && (
            <Tooltip label="Cancel">
              <IconButton
                tone="danger"
                size="sm"
                onClick={() => cancelMut.mutate(r.id)}
                aria-label="Cancel"
              >
                <IconX size={14} />
              </IconButton>
            </Tooltip>
          )}
        </Group>
      ),
    },
  ];

  return (
    <>
      <Group justify="space-between" mb="md">
        <Select
          placeholder="Filter by status"
          clearable
          data={Object.keys(CAMP_STATUS_COLORS).map((s) => ({
            value: s,
            label: s.charAt(0).toUpperCase() + s.slice(1),
          }))}
          value={statusFilter}
          onChange={setStatusFilter}
          w={200}
        />
        {canCreate && (
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={createHandlers.open}>
            Plan Camp
          </Button>
        )}
      </Group>

      <DataTable columns={columns} data={camps} loading={isLoading} rowKey={(r) => r.id} />

      {/* Create Drawer */}
      <Drawer
        opened={createOpen}
        onClose={() => {
          createHandlers.close();
          reset(campDefaults);
        }}
        title="Plan New Camp"
        position="right"
        size="xl"
      >
        <Stack component="form" onSubmit={handleSubmit(handleCreateCamp)}>
          <TextInput
            label="Camp Name"
            required
            error={errors.name?.message}
            {...register("name")}
          />
          <Controller
            control={control}
            name="camp_type"
            render={({ field }) => (
              <Select
                label="Camp Type"
                required
                data={campTypeOptions}
                value={field.value}
                onChange={(value) => field.onChange(value ?? "general_health")}
                error={errors.camp_type?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="organizing_department_id"
            render={({ field }) => (
              <Select
                label="Organizing department"
                description="This becomes the OPD department when a camp participant is opened clinically."
                placeholder="Select service department"
                data={departmentOptions}
                value={field.value}
                onChange={(value) => field.onChange(value ?? null)}
                error={errors.organizing_department_id?.message}
                searchable
                required
              />
            )}
          />
          <Controller
            control={control}
            name="coordinator_id"
            render={({ field }) => (
              <EmployeeSearchSelect
                label="Camp coordinator / attending doctor"
                value={field.value ?? ""}
                onChange={(value) => field.onChange(value || null)}
              />
            )}
          />
          <Controller
            control={control}
            name="scheduled_date"
            render={({ field }) => (
              <DateInput
                label="Scheduled Date"
                required
                value={field.value ? new Date(field.value) : null}
                onChange={(date) =>
                  field.onChange(date ? new Date(date).toISOString().slice(0, 10) : "")
                }
                error={errors.scheduled_date?.message}
              />
            )}
          />
          <TextInput
            label="Start Time"
            placeholder="09:00"
            error={errors.start_time?.message}
            {...register("start_time")}
          />
          <TextInput
            label="End Time"
            placeholder="17:00"
            error={errors.end_time?.message}
            {...register("end_time")}
          />
          <TextInput
            label="Venue Name"
            error={errors.venue_name?.message}
            {...register("venue_name")}
          />
          <TextInput
            label="Venue Address"
            error={errors.venue_address?.message}
            {...register("venue_address")}
          />
          <Group grow>
            <TextInput
              label="City"
              error={errors.venue_city?.message}
              {...register("venue_city")}
            />
            <TextInput
              label="State"
              error={errors.venue_state?.message}
              {...register("venue_state")}
            />
            <TextInput
              label="Pincode"
              error={errors.venue_pincode?.message}
              {...register("venue_pincode")}
            />
          </Group>
          <Controller
            control={control}
            name="expected_participants"
            render={({ field }) => (
              <NumberInput
                label="Expected Participants"
                min={0}
                value={field.value}
                onChange={field.onChange}
                error={errors.expected_participants?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="budget_allocated"
            render={({ field }) => (
              <NumberInput
                label="Budget Allocated"
                min={0}
                decimalScale={2}
                value={field.value}
                onChange={field.onChange}
                error={errors.budget_allocated?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="is_free"
            render={({ field }) => (
              <Switch
                label="Free Camp"
                checked={field.value}
                onChange={(event) => field.onChange(event.currentTarget.checked)}
              />
            )}
          />
          <Textarea
            label="Logistics Notes"
            error={errors.logistics_notes?.message}
            {...register("logistics_notes")}
          />
          <Button tone="primary" type="submit" loading={createMut.isPending}>
            Create Camp
          </Button>
        </Stack>
      </Drawer>

      {/* Detail Drawer */}
      <Drawer
        opened={detailOpen}
        onClose={detailHandlers.close}
        title={selectedCamp?.name ?? "Camp Detail"}
        position="right"
        size="lg"
      >
        {selectedCamp && <CampDetail camp={selectedCamp} />}
      </Drawer>
    </>
  );
}

// ── Camp Detail (team management + stats) ────────────
