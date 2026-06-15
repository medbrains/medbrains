import { zodResolver } from "@hookform/resolvers/zod";
import {
  ActionIcon,
  Group,
  Loader,
  Modal,
  NumberInput,
  Select,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  type FacilitySettingsFormInput,
  type FacilityTypeFormValue,
  facilitySettingsFormSchema,
  facilityTypeFormSchema,
} from "@medbrains/schemas";
import type { Facility } from "@medbrains/types";
import { IconCheck, IconPencil, IconPlus, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { CreateFacilityModal, SelectLabel } from "@/components";
import { Badge, type BadgeTone, Button } from "@/components/ui";
import { useCreateInline } from "@/hooks/useCreateInline";
import { settingsSetupService } from "@/services/settingsSetup.service";

// ── Constants ─────────────────────────────────────────────

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
] satisfies Array<{ value: FacilityTypeFormValue; label: string }>;

const FACILITY_TYPE_TONES: Record<string, BadgeTone> = {
  main_hospital: "primary",
  medical_college: "accent",
  dental_college: "accent",
  nursing_college: "accent",
  pharmacy_college: "success",
  ayush_hospital: "success",
  research_center: "info",
  blood_bank: "danger",
  dialysis_center: "info",
  trauma_center: "danger",
  burn_center: "warning",
  rehabilitation_center: "success",
  palliative_care: "success",
  psychiatric_hospital: "accent",
  eye_hospital: "warning",
  maternity_hospital: "accent",
  pediatric_hospital: "info",
  cancer_center: "accent",
  cardiac_center: "danger",
  neuro_center: "accent",
  ortho_center: "warning",
  day_care_center: "info",
  diagnostic_center: "info",
  telemedicine_hub: "info",
  community_health_center: "success",
  primary_health_center: "success",
  sub_center: "neutral",
  urban_health_center: "success",
  mobile_health_unit: "info",
  other: "neutral",
};

const EMPTY_FORM: FacilitySettingsFormInput = {
  code: "",
  name: "",
  facility_type: "main_hospital",
  parent_id: null,
  address_line1: "",
  city: "",
  phone: "",
  email: "",
  bed_count: "",
  shared_billing: false,
  shared_pharmacy: false,
  shared_lab: false,
  shared_hr: false,
};

function formStateFromFacility(f: Facility): FacilitySettingsFormInput {
  return {
    code: f.code,
    name: f.name,
    facility_type: facilityTypeFormSchema.catch("main_hospital").parse(f.facility_type),
    parent_id: f.parent_id,
    address_line1: f.address_line1 ?? "",
    city: f.city ?? "",
    phone: f.phone ?? "",
    email: f.email ?? "",
    bed_count: f.bed_count ?? "",
    shared_billing: f.shared_billing,
    shared_pharmacy: f.shared_pharmacy,
    shared_lab: f.shared_lab,
    shared_hr: f.shared_hr,
  };
}

function formStateToPayload(form: FacilitySettingsFormInput) {
  const bedCount =
    typeof form.bed_count === "number"
      ? form.bed_count
      : form.bed_count.trim().length > 0
        ? Number(form.bed_count)
        : undefined;

  return {
    code: form.code.trim(),
    name: form.name.trim(),
    facility_type: form.facility_type,
    parent_id: form.parent_id || undefined,
    address_line1: form.address_line1.trim() || undefined,
    city: form.city.trim() || undefined,
    phone: form.phone.trim() || undefined,
    email: form.email?.trim() || undefined,
    bed_count: bedCount,
    shared_billing: form.shared_billing,
    shared_pharmacy: form.shared_pharmacy,
    shared_lab: form.shared_lab,
    shared_hr: form.shared_hr,
  };
}

// ── Facility Modal ────────────────────────────────────────

function FacilityModal({
  opened,
  onClose,
  editingFacility,
  facilities,
}: {
  opened: boolean;
  onClose: () => void;
  editingFacility: Facility | null;
  facilities: Facility[];
}) {
  const queryClient = useQueryClient();
  const isEdit = !!editingFacility;
  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
    setValue,
  } = useForm<FacilitySettingsFormInput>({
    resolver: zodResolver(facilitySettingsFormSchema),
    defaultValues: EMPTY_FORM,
    values: editingFacility ? formStateFromFacility(editingFacility) : EMPTY_FORM,
  });

  const parentInline = useCreateInline<Facility>({ queryKey: ["setup-facilities"] });

  const parentOptions = facilities
    .filter((f) => !editingFacility || f.id !== editingFacility.id)
    .map((f) => ({
      value: f.id,
      label: `${f.code} — ${f.name}`,
    }));

  const createMutation = useMutation({
    mutationFn: (data: ReturnType<typeof formStateToPayload>) =>
      settingsSetupService.createFacility(data),
    onSuccess: () => {
      notifications.show({
        title: "Facility created",
        message: "Facility has been created successfully",
        color: "success",
        icon: <IconCheck size={16} />,
      });
      void queryClient.invalidateQueries({ queryKey: ["setup-facilities"] });
      onClose();
    },
    onError: (err: Error) => {
      notifications.show({
        title: "Create failed",
        message: err.message,
        color: "danger",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: ReturnType<typeof formStateToPayload>) => {
      if (!editingFacility) throw new Error("No facility selected");
      return settingsSetupService.updateFacility(editingFacility.id, data);
    },
    onSuccess: () => {
      notifications.show({
        title: "Facility updated",
        message: "Facility has been updated successfully",
        color: "success",
        icon: <IconCheck size={16} />,
      });
      void queryClient.invalidateQueries({ queryKey: ["setup-facilities"] });
      onClose();
    },
    onError: (err: Error) => {
      notifications.show({
        title: "Update failed",
        message: err.message,
        color: "danger",
      });
    },
  });

  const handleParentCreated = (facility: Facility) => {
    setValue("parent_id", facility.id, { shouldDirty: true, shouldValidate: true });
    parentInline.onCreated(facility);
    parentInline.clearPendingSelect();
  };

  const submitFacility = handleSubmit((form) => {
    const payload = formStateToPayload(form);

    if (isEdit) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  });

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={isEdit ? "Edit Facility" : "Add Facility"}
      size="lg"
    >
      <Stack gap="sm">
        <Group grow>
          <TextInput
            label="Code"
            placeholder="FAC-001"
            error={errors.code?.message}
            {...register("code")}
            required
          />
          <TextInput
            label="Name"
            placeholder="Main Hospital"
            error={errors.name?.message}
            {...register("name")}
            required
          />
        </Group>

        <Group grow>
          <Controller
            control={control}
            name="facility_type"
            render={({ field }) => (
              <Select
                label="Facility Type"
                data={FACILITY_TYPE_OPTIONS}
                value={field.value}
                onChange={(value) => field.onChange(value ?? "main_hospital")}
                error={errors.facility_type?.message}
                required
                placeholder="Select type..."
              />
            )}
          />
          <Controller
            control={control}
            name="parent_id"
            render={({ field }) => (
              <Select
                label={
                  <SelectLabel label="Parent Facility" onCreate={parentInline.openCreateModal} />
                }
                data={parentOptions}
                value={field.value}
                onChange={field.onChange}
                searchable
                clearable
                placeholder="None (top-level)"
              />
            )}
          />
        </Group>

        <TextInput
          label="Address"
          placeholder="123 Medical Lane"
          error={errors.address_line1?.message}
          {...register("address_line1")}
        />

        <Group grow>
          <TextInput
            label="City"
            placeholder="Mumbai"
            error={errors.city?.message}
            {...register("city")}
          />
          <Controller
            control={control}
            name="bed_count"
            render={({ field }) => (
              <NumberInput
                label="Bed Count"
                placeholder="100"
                min={0}
                value={field.value}
                onChange={field.onChange}
                error={errors.bed_count?.message}
              />
            )}
          />
        </Group>

        <Group grow>
          <TextInput
            label="Phone"
            placeholder="+91 22 1234 5678"
            error={errors.phone?.message}
            {...register("phone")}
          />
          <TextInput
            label="Email"
            placeholder="admin@hospital.com"
            error={errors.email?.message}
            {...register("email")}
          />
        </Group>

        <Text size="sm" fw={500} mt="xs">
          Shared Services
        </Text>
        <Group>
          <Controller
            control={control}
            name="shared_billing"
            render={({ field }) => (
              <Switch
                label="Billing"
                checked={field.value}
                onChange={(event) => field.onChange(event.currentTarget.checked)}
              />
            )}
          />
          <Controller
            control={control}
            name="shared_pharmacy"
            render={({ field }) => (
              <Switch
                label="Pharmacy"
                checked={field.value}
                onChange={(event) => field.onChange(event.currentTarget.checked)}
              />
            )}
          />
          <Controller
            control={control}
            name="shared_lab"
            render={({ field }) => (
              <Switch
                label="Lab"
                checked={field.value}
                onChange={(event) => field.onChange(event.currentTarget.checked)}
              />
            )}
          />
          <Controller
            control={control}
            name="shared_hr"
            render={({ field }) => (
              <Switch
                label="HR"
                checked={field.value}
                onChange={(event) => field.onChange(event.currentTarget.checked)}
              />
            )}
          />
        </Group>

        <Group justify="flex-end" mt="md">
          <Button tone="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            tone="primary"
            onClick={() => void submitFacility()}
            loading={createMutation.isPending || updateMutation.isPending}
          >
            {isEdit ? "Save" : "Create"}
          </Button>
        </Group>
      </Stack>

      <CreateFacilityModal
        opened={parentInline.createModalOpened}
        onClose={parentInline.closeCreateModal}
        onCreated={handleParentCreated}
      />
    </Modal>
  );
}

// ── Main Component ────────────────────────────────────────

export function FacilitiesSettings() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingFacility, setEditingFacility] = useState<Facility | null>(null);

  const { data: facilities, isLoading } = useQuery({
    queryKey: ["setup-facilities"],
    queryFn: () => settingsSetupService.listFacilities(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => settingsSetupService.deleteFacility(id),
    onSuccess: () => {
      notifications.show({
        title: "Facility deleted",
        message: "Facility has been removed",
        color: "success",
        icon: <IconCheck size={16} />,
      });
      void queryClient.invalidateQueries({ queryKey: ["setup-facilities"] });
    },
    onError: (err: Error) => {
      notifications.show({
        title: "Delete failed",
        message: err.message,
        color: "danger",
      });
    },
  });

  const openCreate = () => {
    setEditingFacility(null);
    setModalOpen(true);
  };

  const openEdit = (facility: Facility) => {
    setEditingFacility(facility);
    setModalOpen(true);
  };

  const handleDelete = (facility: Facility) => {
    if (window.confirm(`Delete facility "${facility.name}"? This cannot be undone.`)) {
      deleteMutation.mutate(facility.id);
    }
  };

  if (isLoading) {
    return (
      <Stack align="center" py="xl">
        <Loader size="sm" />
        <Text size="sm" c="dimmed">
          Loading facilities...
        </Text>
      </Stack>
    );
  }

  const rows = (facilities ?? []).map((facility) => (
    <Table.Tr key={facility.id}>
      <Table.Td>
        <Text size="sm" ff="monospace" fw={500}>
          {facility.code}
        </Text>
      </Table.Td>
      <Table.Td>
        <Text size="sm">{facility.name}</Text>
      </Table.Td>
      <Table.Td>
        <Badge size="sm" tone={FACILITY_TYPE_TONES[facility.facility_type] ?? "neutral"}>
          {facility.facility_type.replace(/_/g, " ")}
        </Badge>
      </Table.Td>
      <Table.Td>
        <Text size="sm" c="dimmed">
          {facility.city ?? "-"}
        </Text>
      </Table.Td>
      <Table.Td>
        <Text size="sm">{facility.bed_count ?? "-"}</Text>
      </Table.Td>
      <Table.Td>
        <Badge size="sm" tone={facility.is_active ? "success" : "neutral"}>
          {facility.is_active ? "Active" : "Inactive"}
        </Badge>
      </Table.Td>
      <Table.Td>
        <Group gap={4}>
          <ActionIcon
            variant="subtle"
            color="primary"
            onClick={() => openEdit(facility)}
            aria-label="Edit"
          >
            <IconPencil size={16} />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            color="danger"
            onClick={() => handleDelete(facility)}
            loading={deleteMutation.isPending}
            aria-label="Delete"
          >
            <IconTrash size={16} />
          </ActionIcon>
        </Group>
      </Table.Td>
    </Table.Tr>
  ));

  return (
    <>
      <Group justify="space-between" mb="md">
        <Text size="lg" fw={600}>
          Facilities
        </Text>
        <Button tone="primary" size="sm" leftSection={<IconPlus size={14} />} onClick={openCreate}>
          Add Facility
        </Button>
      </Group>

      <Table striped highlightOnHover withTableBorder withColumnBorders>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Code</Table.Th>
            <Table.Th>Name</Table.Th>
            <Table.Th>Type</Table.Th>
            <Table.Th>City</Table.Th>
            <Table.Th>Beds</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th w={80} />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.length > 0 ? (
            rows
          ) : (
            <Table.Tr>
              <Table.Td colSpan={7}>
                <Text ta="center" c="dimmed" py="lg">
                  No facilities configured. Click "Add Facility" to get started.
                </Text>
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>

      <FacilityModal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        editingFacility={editingFacility}
        facilities={facilities ?? []}
      />
    </>
  );
}
