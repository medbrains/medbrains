// Emergency ResuscitationVisitPanel — split from emergency.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Card,
  Group,
  NumberInput,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import type { EmergencyResuscitationLogFormInput } from "@medbrains/schemas";
import { emergencyResuscitationLogFormSchema } from "@medbrains/schemas";
import type { CreateResuscitationLogRequest, ErResuscitationLog } from "@medbrains/types";
import { IconFirstAidKit, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { DataTable } from "@/components";
import { Badge, Button, toast } from "@/components/ui";
import {
  emergencyOptionalInteger,
  emergencyOptionalText,
  emergencyResuscitationLogTypeOptions,
} from "@/forms/emergency.form";
import { emergencyService } from "@/services/emergency.service";
import {
  emptyResuscitationLogForm,
  resuscitationLogColor,
  resuscitationLogDetails,
} from "./shared";

export function ResuscitationVisitPanel({
  visitId,
  canView,
  canCreate,
}: {
  visitId: string;
  canView: boolean;
  canCreate: boolean;
}) {
  const qc = useQueryClient();
  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<EmergencyResuscitationLogFormInput>({
    resolver: zodResolver(emergencyResuscitationLogFormSchema),
    defaultValues: { ...emptyResuscitationLogForm, er_visit_id: visitId },
  });
  const selectedLogType = watch("log_type");
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["er-resuscitation-logs", visitId],
    queryFn: () => emergencyService.listResuscitationLogs(visitId),
    enabled: canView,
  });
  const mutation = useMutation({
    mutationFn: (data: CreateResuscitationLogRequest) =>
      emergencyService.createResuscitationLog(visitId, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["er-resuscitation-logs", visitId] });
      reset({ ...emptyResuscitationLogForm, er_visit_id: visitId });
      toast.success("The ER resuscitation log has been updated.", {
        title: "Resuscitation entry saved",
      });
    },
  });

  const submitResuscitationLog = (values: EmergencyResuscitationLogFormInput) => {
    if (!canCreate) return;
    mutation.mutate({
      log_type: values.log_type,
      medication_name: emergencyOptionalText(values.medication_name),
      dose: emergencyOptionalText(values.dose),
      route: emergencyOptionalText(values.route),
      fluid_name: emergencyOptionalText(values.fluid_name),
      fluid_volume_ml: emergencyOptionalInteger(values.fluid_volume_ml),
      procedure_name: emergencyOptionalText(values.procedure_name),
      procedure_notes: emergencyOptionalText(values.procedure_notes),
      notes: emergencyOptionalText(values.notes),
    });
  };

  const columns = [
    {
      key: "timestamp",
      label: "Time",
      render: (row: ErResuscitationLog) => (
        <Text size="sm">{new Date(row.timestamp).toLocaleString()}</Text>
      ),
    },
    {
      key: "log_type",
      label: "Type",
      render: (row: ErResuscitationLog) => (
        <Badge tone={resuscitationLogColor(row.log_type)}>{row.log_type.replace(/_/g, " ")}</Badge>
      ),
    },
    {
      key: "details",
      label: "Details",
      render: (row: ErResuscitationLog) => <Text size="sm">{resuscitationLogDetails(row)}</Text>,
    },
    {
      key: "notes",
      label: "Notes",
      render: (row: ErResuscitationLog) => (
        <Text size="sm" c={row.notes ? undefined : "dimmed"}>
          {row.notes ?? "---"}
        </Text>
      ),
    },
  ];

  return (
    <Card withBorder>
      <Stack>
        <Group gap="xs">
          <IconFirstAidKit size={18} />
          <Text fw={700}>Resuscitation</Text>
        </Group>
        {canCreate && (
          <Paper
            component="form"
            withBorder
            radius="md"
            p="md"
            onSubmit={handleSubmit(submitResuscitationLog)}
          >
            <Stack>
              <Controller
                name="log_type"
                control={control}
                render={({ field }) => (
                  <Select
                    label="Entry type"
                    data={emergencyResuscitationLogTypeOptions}
                    value={field.value}
                    onChange={(value) => field.onChange(value ?? "medication")}
                    error={errors.log_type?.message}
                  />
                )}
              />
              {selectedLogType === "medication" && (
                <SimpleGrid cols={{ base: 1, sm: 3 }}>
                  <Controller
                    name="medication_name"
                    control={control}
                    render={({ field }) => (
                      <TextInput
                        label="Medication"
                        required
                        error={errors.medication_name?.message}
                        {...field}
                      />
                    )}
                  />
                  <Controller
                    name="dose"
                    control={control}
                    render={({ field }) => (
                      <TextInput label="Dose" required error={errors.dose?.message} {...field} />
                    )}
                  />
                  <Controller
                    name="route"
                    control={control}
                    render={({ field }) => (
                      <TextInput label="Route" required error={errors.route?.message} {...field} />
                    )}
                  />
                </SimpleGrid>
              )}
              {selectedLogType === "fluid" && (
                <SimpleGrid cols={{ base: 1, sm: 3 }}>
                  <Controller
                    name="fluid_name"
                    control={control}
                    render={({ field }) => (
                      <TextInput
                        label="Fluid"
                        required
                        error={errors.fluid_name?.message}
                        {...field}
                      />
                    )}
                  />
                  <Controller
                    name="fluid_volume_ml"
                    control={control}
                    render={({ field }) => (
                      <NumberInput
                        label="Volume ml"
                        required
                        min={1}
                        step={50}
                        value={field.value}
                        onChange={field.onChange}
                        error={errors.fluid_volume_ml?.message}
                      />
                    )}
                  />
                  <Controller
                    name="route"
                    control={control}
                    render={({ field }) => (
                      <TextInput label="Route" required error={errors.route?.message} {...field} />
                    )}
                  />
                </SimpleGrid>
              )}
              {["procedure", "airway", "cpr", "defibrillation"].includes(selectedLogType) && (
                <SimpleGrid cols={{ base: 1, sm: 2 }}>
                  <Controller
                    name="procedure_name"
                    control={control}
                    render={({ field }) => (
                      <TextInput
                        label="Procedure/action"
                        required
                        error={errors.procedure_name?.message}
                        {...field}
                      />
                    )}
                  />
                  <Controller
                    name="procedure_notes"
                    control={control}
                    render={({ field }) => (
                      <Textarea
                        label="Procedure notes"
                        error={errors.procedure_notes?.message}
                        {...field}
                      />
                    )}
                  />
                </SimpleGrid>
              )}
              <Controller
                name="notes"
                control={control}
                render={({ field }) => (
                  <Textarea
                    label="Clinical notes"
                    minRows={2}
                    error={errors.notes?.message}
                    {...field}
                  />
                )}
              />
              <Group justify="flex-end">
                <Button
                  tone="primary"
                  type="submit"
                  leftSection={<IconPlus size={16} />}
                  loading={mutation.isPending}
                >
                  Save Entry
                </Button>
              </Group>
            </Stack>
          </Paper>
        )}
        {canView ? (
          <DataTable columns={columns} data={logs} loading={isLoading} rowKey={(row) => row.id} />
        ) : (
          <Text size="sm" c="dimmed">
            This role can create resuscitation entries, but the resuscitation log list is
            restricted.
          </Text>
        )}
      </Stack>
    </Card>
  );
}
