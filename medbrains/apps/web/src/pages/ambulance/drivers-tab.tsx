// Ambulance DriversTab — split from ambulance.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import { Drawer, Group, Select, Stack, Switch, Text, TextInput } from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type { AmbulanceDriverFormInput } from "@medbrains/schemas";
import { ambulanceDriverFormSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type { AmbulanceDriverRow, CreateAmbulanceDriverRequest } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { DataTable } from "@/components";
import type { Column } from "@/components/DataTable";
import { EmployeeSearchSelect } from "@/components/EmployeeSearchSelect";
import type { BadgeTone } from "@/components/ui";
import { Badge, Button } from "@/components/ui";
import {
  ambulanceLicenseTypeOptions,
  ambulanceOptionalText,
  ambulanceShiftPatternOptions,
} from "@/forms/ambulance.form";
import { ambulanceService } from "@/services/ambulance.service";
import { isExpired, isExpiringSoon, toDateInputValue, toIsoDateInputValue } from "./shared";

const emptyDriverForm: AmbulanceDriverFormInput = {
  employee_id: "",
  license_number: "",
  license_type: "LMV",
  license_expiry: "",
  bls_certified: false,
  defensive_driving: false,
  shift_pattern: "",
  phone: "",
};

export function DriversTab() {
  const qc = useQueryClient();
  const canManage = useHasPermission(P.AMBULANCE.DRIVERS_MANAGE);
  const [opened, { open, close }] = useDisclosure(false);
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AmbulanceDriverFormInput>({
    resolver: zodResolver(ambulanceDriverFormSchema),
    defaultValues: emptyDriverForm,
  });

  const { data = [], isLoading } = useQuery({
    queryKey: ["ambulance-drivers"],
    queryFn: () => ambulanceService.listAmbulanceDrivers(),
  });

  const createMut = useMutation({
    mutationFn: (d: CreateAmbulanceDriverRequest) => ambulanceService.createAmbulanceDriver(d),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["ambulance-drivers"] });
      close();
      notifications.show({ title: "Driver added", message: "Driver registered", color: "green" });
    },
    onError: (e: Error) =>
      notifications.show({ title: "Could not add driver", message: e.message, color: "red" }),
  });

  const columns: Column<AmbulanceDriverRow>[] = [
    {
      key: "employee_id",
      label: "Employee ID",
      render: (r) => <Text size="sm">{r.employee_id.slice(0, 8)}</Text>,
    },
    {
      key: "license_number",
      label: "License #",
      render: (r) => (
        <Text fw={600} size="sm">
          {r.license_number}
        </Text>
      ),
    },
    {
      key: "license_type",
      label: "Type",
      render: (r) => (
        <Badge size="sm" tone="neutral" variant="light">
          {r.license_type}
        </Badge>
      ),
    },
    {
      key: "license_expiry",
      label: "Expiry",
      render: (r) => {
        const exp = r.license_expiry;
        const tone: BadgeTone = isExpired(exp)
          ? "danger"
          : isExpiringSoon(exp)
            ? "warning"
            : "success";
        return (
          <Badge size="sm" tone={tone}>
            {exp}
          </Badge>
        );
      },
    },
    {
      key: "is_active",
      label: "Active",
      render: (r) => (
        <Badge size="sm" tone={r.is_active ? "success" : "neutral"}>
          {r.is_active ? "Yes" : "No"}
        </Badge>
      ),
    },
    {
      key: "bls_certified",
      label: "BLS",
      render: (r) =>
        r.bls_certified ? (
          <Badge size="sm" tone="success">
            Certified
          </Badge>
        ) : (
          <Text size="sm" c="dimmed">
            No
          </Text>
        ),
    },
    {
      key: "shift_pattern",
      label: "Shift",
      render: (r) => <Text size="sm">{r.shift_pattern ?? "—"}</Text>,
    },
  ];

  return (
    <>
      <Group justify="flex-end" mb="md">
        {canManage && (
          <Button
            tone="primary"
            leftSection={<IconPlus size={16} />}
            onClick={() => {
              reset(emptyDriverForm);
              open();
            }}
          >
            Add Driver
          </Button>
        )}
      </Group>
      <DataTable columns={columns} data={data} loading={isLoading} rowKey={(r) => r.id} />
      <Drawer opened={opened} onClose={close} title="Add Driver" position="right" size="xl">
        <Stack
          component="form"
          onSubmit={handleSubmit((values) =>
            createMut.mutate({
              employee_id: values.employee_id.trim(),
              license_number: values.license_number.trim(),
              license_type: values.license_type,
              license_expiry: values.license_expiry,
              bls_certified: values.bls_certified,
              defensive_driving: values.defensive_driving,
              shift_pattern: values.shift_pattern || undefined,
              phone: ambulanceOptionalText(values.phone),
            }),
          )}
        >
          <Controller
            name="employee_id"
            control={control}
            render={({ field }) => (
              <EmployeeSearchSelect
                label="Employee"
                required
                value={field.value}
                onChange={field.onChange}
                error={errors.employee_id?.message}
              />
            )}
          />
          <Controller
            name="license_number"
            control={control}
            render={({ field }) => (
              <TextInput
                label="License Number"
                required
                {...field}
                error={errors.license_number?.message}
              />
            )}
          />
          <Controller
            name="license_type"
            control={control}
            render={({ field }) => (
              <Select
                label="License Type"
                required
                data={ambulanceLicenseTypeOptions}
                value={field.value}
                onChange={(value) => field.onChange(value ?? "LMV")}
                error={errors.license_type?.message}
              />
            )}
          />
          <Controller
            name="license_expiry"
            control={control}
            render={({ field }) => (
              <DateInput
                label="License Expiry"
                required
                value={toDateInputValue(field.value)}
                onChange={(date) => field.onChange(toIsoDateInputValue(date))}
                error={errors.license_expiry?.message}
              />
            )}
          />
          <Controller
            name="bls_certified"
            control={control}
            render={({ field }) => (
              <Switch
                label="BLS Certified"
                checked={field.value}
                onChange={(event) => field.onChange(event.currentTarget.checked)}
              />
            )}
          />
          <Controller
            name="defensive_driving"
            control={control}
            render={({ field }) => (
              <Switch
                label="Defensive Driving Trained"
                checked={field.value}
                onChange={(event) => field.onChange(event.currentTarget.checked)}
              />
            )}
          />
          <Controller
            name="shift_pattern"
            control={control}
            render={({ field }) => (
              <Select
                label="Shift Pattern"
                data={ambulanceShiftPatternOptions}
                value={field.value || null}
                onChange={(value) => field.onChange(value ?? "")}
                clearable
                error={errors.shift_pattern?.message}
              />
            )}
          />
          <Controller
            name="phone"
            control={control}
            render={({ field }) => (
              <TextInput label="Phone" {...field} error={errors.phone?.message} />
            )}
          />
          <Button tone="primary" type="submit" loading={createMut.isPending}>
            Add Driver
          </Button>
        </Stack>
      </Drawer>
    </>
  );
}

// ── Maintenance Tab ─────────────────────────────────────
