import { zodResolver } from "@hookform/resolvers/zod";
import { Group, NumberInput, Select, Stack, Switch, Textarea, TextInput } from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { notifications } from "@mantine/notifications";
import type { CampCreateFormInput } from "@medbrains/schemas";
import { campCreateFormSchema } from "@medbrains/schemas";
import type { CreateCampRequest, DepartmentRow } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconArrowLeft, IconTent } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import { PageHeader } from "@/components";
import { EmployeeSearchSelect } from "@/components/EmployeeSearchSelect";
import { Button } from "@/components/ui";
import {
  campOptionalInteger,
  campOptionalNumber,
  campOptionalText,
  campTypeOptions,
} from "@/forms/camp.form";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { campService } from "@/services/camp.service";
import { lookupsService } from "@/services/lookups.service";
import { CAMP_CREATE_DEFAULTS } from "./shared";

/**
 * Planning a camp, on the screen its own route already pointed at.
 *
 * `/camp/new` has been routed since before this work; the component behind
 * it returned the camp landing page, so the address existed and opened
 * nothing. The form lived in a right-hand drawer.
 *
 * It is the largest form in the module — dates, venue, staffing, service
 * lines, four charge modes and eight budget lines — and it is filled in
 * before a camp exists, often away from the desk. A third of the screen was
 * never the right place for it.
 */
export function CampCreatePage() {
  useRequirePermission(P.CAMP.CREATE);

  const navigate = useNavigate();
  const qc = useQueryClient();

  const backToList = () => navigate("/camp#camps");

  const { data: departments = [] } = useQuery<DepartmentRow[]>({
    queryKey: ["departments"],
    queryFn: () => lookupsService.listDepartments(),
    staleTime: 600_000,
  });
  const departmentOptions = useMemo(
    () => departments.map((d: DepartmentRow) => ({ value: d.id, label: d.name })),
    [departments],
  );

  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CampCreateFormInput>({
    resolver: zodResolver(campCreateFormSchema),
    defaultValues: CAMP_CREATE_DEFAULTS,
  });

  const createCamp = useMutation({
    mutationFn: (data: CreateCampRequest) => campService.createCamp(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["camps"] });
      notifications.show({
        title: "Camp Created",
        message: "Camp planned successfully",
        color: "success",
      });
      backToList();
    },
  });

  const submit = (values: CampCreateFormInput) => {
    createCamp.mutate({
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

  return (
    <Stack>
      <PageHeader
        title="Plan New Camp"
        icon={<IconTent size={20} stroke={1.5} />}
        actions={
          <Button tone="secondary" leftSection={<IconArrowLeft size={14} />} onClick={backToList}>
            Camps
          </Button>
        }
      />
      <Stack component="form" onSubmit={handleSubmit(submit)}>
        <TextInput label="Camp Name" required error={errors.name?.message} {...register("name")} />
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
          <TextInput label="City" error={errors.venue_city?.message} {...register("venue_city")} />
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
        <Button tone="primary" type="submit" loading={createCamp.isPending}>
          Create Camp
        </Button>
      </Stack>
    </Stack>
  );
}
