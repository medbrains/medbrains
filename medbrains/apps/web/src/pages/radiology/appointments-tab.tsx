// Radiology appointments — open imaging orders, soonest first.

import { zodResolver } from "@hookform/resolvers/zod";
import { Modal, Select, Stack, Text, Textarea } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type { RadiologyAppointmentFormInput } from "@medbrains/schemas";
import { radiologyAppointmentFormSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type {
  CreateRadiologyAppointmentRequest,
  RadiologyAppointment,
  RadiologyModality,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { DataTable, PageHeader } from "@/components";
import { EncounterSelect } from "@/components/EncounterSelect";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Badge, Button } from "@/components/ui";
import { radiologyOptionalText, radiologyPriorityOptions } from "@/forms/radiology.form";
import { statusColor } from "@/lib/status-colors";
import { radiologyService } from "@/services/radiology.service";
import { colorToBadgeTone } from "./shared";

export function AppointmentsTab() {
  const canCreate = useHasPermission(P.RADIOLOGY.ORDERS_CREATE);
  const qc = useQueryClient();
  const [createOpen, createHandlers] = useDisclosure(false);

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ["radiology-appointments"],
    queryFn: () => radiologyService.listRadiologyAppointments(),
  });

  const { data: modalities } = useQuery({
    queryKey: ["radiology-modalities"],
    queryFn: () => radiologyService.listRadiologyModalities(),
  });

  const appointmentDefaults: RadiologyAppointmentFormInput = {
    patient_id: "",
    modality_id: "",
    encounter_id: "",
    priority: "routine",
    notes: "",
  };
  const {
    control,
    register,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm<RadiologyAppointmentFormInput>({
    resolver: zodResolver(radiologyAppointmentFormSchema),
    defaultValues: appointmentDefaults,
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateRadiologyAppointmentRequest) =>
      radiologyService.createRadiologyAppointment(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["radiology-appointments"] });
      notifications.show({ title: "Appointment created", message: "", color: "success" });
      reset(appointmentDefaults);
      createHandlers.close();
    },
  });

  const modalityOptions = (modalities ?? [])
    .filter((m: RadiologyModality) => m.is_active)
    .map((m: RadiologyModality) => ({ value: m.id, label: `${m.code} — ${m.name}` }));

  const handleCreateAppointment = (values: RadiologyAppointmentFormInput) => {
    createMutation.mutate({
      patient_id: values.patient_id.trim(),
      modality_id: values.modality_id.trim(),
      encounter_id: values.encounter_id.trim(),
      priority: values.priority,
      notes: radiologyOptionalText(values.notes),
    });
  };

  const columns = [
    {
      key: "patient_name" as const,
      label: "Patient",
      render: (r: RadiologyAppointment) => (
        <Stack gap={0}>
          <Text size="sm">{r.patient_name}</Text>
          <Text size="xs" c="dimmed" ff="monospace">
            {r.uhid}
          </Text>
        </Stack>
      ),
    },
    {
      key: "modality" as const,
      label: "Study",
      render: (r: RadiologyAppointment) =>
        r.body_part ? `${r.modality} — ${r.body_part}` : r.modality,
    },
    {
      key: "priority" as const,
      label: "Priority",
      render: (r: RadiologyAppointment) => (
        <Badge size="xs" tone={colorToBadgeTone(statusColor(r.priority))}>
          {r.priority}
        </Badge>
      ),
    },
    {
      key: "status" as const,
      label: "Status",
      render: (r: RadiologyAppointment) => r.status.replaceAll("_", " "),
    },
    {
      key: "scheduled_at" as const,
      label: "When",
      render: (r: RadiologyAppointment) =>
        r.scheduled_at
          ? new Date(r.scheduled_at).toLocaleString()
          : `Not scheduled (ordered ${new Date(r.created_at).toLocaleDateString()})`,
    },
    {
      key: "notes" as const,
      label: "Notes",
      render: (r: RadiologyAppointment) => r.notes ?? "—",
    },
  ];

  return (
    <>
      <PageHeader
        title="Radiology Appointments"
        subtitle="Scheduled imaging appointments"
        actions={
          canCreate ? (
            <Button
              tone="primary"
              leftSection={<IconPlus size={16} />}
              size="xs"
              onClick={createHandlers.open}
            >
              Create Appointment
            </Button>
          ) : undefined
        }
      />

      <DataTable columns={columns} data={appointments} rowKey={(r) => r.id} loading={isLoading} />

      <Modal
        opened={createOpen}
        onClose={createHandlers.close}
        title="Create Radiology Appointment"
        size="md"
      >
        <Stack component="form" onSubmit={handleSubmit(handleCreateAppointment)}>
          <Controller
            control={control}
            name="patient_id"
            render={({ field }) => (
              <PatientSearchSelect
                value={field.value}
                onChange={field.onChange}
                error={errors.patient_id?.message}
                required
              />
            )}
          />
          <Controller
            control={control}
            name="modality_id"
            render={({ field }) => (
              <Select
                label="Modality"
                required
                data={modalityOptions}
                value={field.value || null}
                onChange={(value) => field.onChange(value ?? "")}
                error={errors.modality_id?.message}
                searchable
              />
            )}
          />
          <Controller
            control={control}
            name="encounter_id"
            render={({ field }) => (
              <EncounterSelect
                label="Encounter"
                required
                value={field.value}
                onChange={field.onChange}
                error={errors.encounter_id?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="priority"
            render={({ field }) => (
              <Select
                label="Priority"
                data={radiologyPriorityOptions}
                value={field.value}
                onChange={(value) => field.onChange(value ?? "routine")}
                error={errors.priority?.message}
              />
            )}
          />
          <Textarea label="Notes" error={errors.notes?.message} {...register("notes")} />
          <Button tone="primary" type="submit" loading={createMutation.isPending}>
            Create Appointment
          </Button>
        </Stack>
      </Modal>
    </>
  );
}

// ══════════════════════════════════════════════════════════
//  DICOM Studies Tab
// ══════════════════════════════════════════════════════════
