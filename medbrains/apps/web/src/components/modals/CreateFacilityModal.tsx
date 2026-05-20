import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Group, Modal, Select, Stack, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { CreateFacilityFormInput } from "@medbrains/schemas";
import { createFacilityFormSchema } from "@medbrains/schemas";
import type { Facility } from "@medbrains/types";
import { IconCheck } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { adminAccessService } from "../../services/adminAccess.service";

const FACILITY_TYPE_OPTIONS = [
  { value: "main_hospital", label: "Main Hospital" },
  { value: "medical_college", label: "Medical College" },
  { value: "dental_college", label: "Dental College" },
  { value: "nursing_college", label: "Nursing College" },
  { value: "pharmacy_college", label: "Pharmacy College" },
  { value: "ayush_hospital", label: "AYUSH Hospital" },
  { value: "research_center", label: "Research Center" },
  { value: "blood_bank", label: "Blood Bank" },
  { value: "dialysis_center", label: "Dialysis Center" },
  { value: "trauma_center", label: "Trauma Center" },
  { value: "burn_center", label: "Burn Center" },
  { value: "rehabilitation_center", label: "Rehabilitation Center" },
  { value: "palliative_care", label: "Palliative Care" },
  { value: "psychiatric_hospital", label: "Psychiatric Hospital" },
  { value: "eye_hospital", label: "Eye Hospital" },
  { value: "maternity_hospital", label: "Maternity Hospital" },
  { value: "pediatric_hospital", label: "Pediatric Hospital" },
  { value: "cancer_center", label: "Cancer Center" },
  { value: "cardiac_center", label: "Cardiac Center" },
  { value: "neuro_center", label: "Neuro Center" },
  { value: "ortho_center", label: "Ortho Center" },
  { value: "day_care_center", label: "Day Care Center" },
  { value: "diagnostic_center", label: "Diagnostic Center" },
  { value: "telemedicine_hub", label: "Telemedicine Hub" },
  { value: "community_health_center", label: "Community Health Center" },
  { value: "primary_health_center", label: "Primary Health Center" },
  { value: "sub_center", label: "Sub Center" },
  { value: "urban_health_center", label: "Urban Health Center" },
  { value: "mobile_health_unit", label: "Mobile Health Unit" },
  { value: "other", label: "Other" },
];

interface CreateFacilityModalProps {
  opened: boolean;
  onClose: () => void;
  onCreated?: (facility: Facility) => void;
}

export function CreateFacilityModal({ opened, onClose, onCreated }: CreateFacilityModalProps) {
  const queryClient = useQueryClient();
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateFacilityFormInput>({
    resolver: zodResolver(createFacilityFormSchema),
    defaultValues: { code: "", name: "", facility_type: "main_hospital" },
    mode: "onTouched",
  });

  const handleClose = () => {
    reset();
    onClose();
  };

  const createMutation = useMutation({
    mutationFn: (data: CreateFacilityFormInput) =>
      adminAccessService.createFacility({
        code: data.code.trim(),
        name: data.name.trim(),
        facility_type: data.facility_type,
      }),
    onSuccess: (created: Facility) => {
      notifications.show({
        title: "Facility created",
        message: "Facility has been created successfully",
        color: "success",
        icon: <IconCheck size={16} />,
      });
      void queryClient.invalidateQueries({ queryKey: ["setup-facilities"] });
      reset();
      if (onCreated) {
        onCreated(created);
      } else {
        onClose();
      }
    },
    onError: (err: Error) => {
      notifications.show({
        title: "Create failed",
        message: err.message,
        color: "danger",
      });
    },
  });

  const submitFacility = handleSubmit((values) => createMutation.mutate(values));

  return (
    <Modal opened={opened} onClose={handleClose} title="Add Facility" size="md">
      <Stack gap="sm">
        <Controller
          control={control}
          name="code"
          render={({ field }) => (
            <TextInput
              label="Code"
              placeholder="FAC-001"
              value={field.value}
              onChange={(e) => field.onChange(e.currentTarget.value.toUpperCase())}
              error={errors.code?.message}
              required
            />
          )}
        />
        <Controller
          control={control}
          name="name"
          render={({ field }) => (
            <TextInput
              label="Name"
              placeholder="Main Hospital"
              value={field.value}
              onChange={field.onChange}
              error={errors.name?.message}
              required
            />
          )}
        />
        <Controller
          control={control}
          name="facility_type"
          render={({ field }) => (
            <Select
              label="Facility Type"
              allowDeselect={false}
              data={FACILITY_TYPE_OPTIONS}
              value={field.value}
              onChange={(value) => field.onChange(value ?? "main_hospital")}
              error={errors.facility_type?.message}
              required
              placeholder="Select type..."
            />
          )}
        />
        <Group justify="flex-end" mt="md">
          <Button variant="light" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={() => void submitFacility()} loading={createMutation.isPending}>
            Create
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
