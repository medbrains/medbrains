import { useEffect, useState } from "react";
import {
  ActionIcon,
  Badge,
  Button,
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
  IconCheck,
  IconPencil,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import type { Facility } from "@medbrains/types";
import { SelectLabel, CreateFacilityModal } from "../../../components";
import { useCreateInline } from "../../../hooks/useCreateInline";

// ── Constants ─────────────────────────────────────────────

const FACILITY_TYPE_OPTIONS = [
  { value: "hospital", label: "Hospital" },
  { value: "clinic", label: "Clinic" },
  { value: "satellite_center", label: "Satellite Center" },
  { value: "nursing_home", label: "Nursing Home" },
  { value: "blood_bank", label: "Blood Bank" },
  { value: "diagnostic_center", label: "Diagnostic Center" },
  { value: "pharmacy", label: "Pharmacy" },
  { value: "warehouse", label: "Warehouse" },
];

const FACILITY_TYPE_COLORS: Record<string, string> = {
  hospital: "primary",
  clinic: "success",
  satellite_center: "violet",
  nursing_home: "orange",
  blood_bank: "danger",
  diagnostic_center: "info",
  pharmacy: "teal",
  warehouse: "slate",
};

// ── Form State ────────────────────────────────────────────

interface FacilityFormState {
  code: string;
  name: string;
  facility_type: string | null;
  parent_id: string | null;
  address_line1: string;
  city: string;
  phone: string;
  email: string;
  bed_count: number | string;
  shared_billing: boolean;
  shared_pharmacy: boolean;
  shared_lab: boolean;
  shared_hr: boolean;
}

const EMPTY_FORM: FacilityFormState = {
  code: "",
  name: "",
  facility_type: null,
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

function formStateFromFacility(f: Facility): FacilityFormState {
  return {
    code: f.code,
    name: f.name,
    facility_type: f.facility_type,
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

function formStateToPayload(form: FacilityFormState) {
  return {
    code: form.code,
    name: form.name,
    facility_type: form.facility_type ?? "hospital",
    parent_id: form.parent_id || undefined,
    address_line1: form.address_line1 || undefined,
    city: form.city || undefined,
    phone: form.phone || undefined,
    email: form.email || undefined,
    bed_count: typeof form.bed_count === "number" ? form.bed_count : undefined,
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

  const [form, setForm] = useState<FacilityFormState>(EMPTY_FORM);

  const parentInline = useCreateInline<Facility>({ queryKey: ["setup-facilities"] });

  useEffect(() => {
    if (parentInline.pendingSelect) {
      setForm((prev) => ({ ...prev, parent_id: parentInline.pendingSelect!.id }));
      parentInline.clearPendingSelect();
    }
  }, [parentInline.pendingSelect, parentInline.clearPendingSelect]);

  const updateField = <K extends keyof FacilityFormState>(
    key: K,
    value: FacilityFormState[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleOpen = () => {
    if (editingFacility) {
      setForm(formStateFromFacility(editingFacility));
    } else {
      setForm(EMPTY_FORM);
    }
  };

  const parentOptions = facilities
    .filter((f) => !editingFacility || f.id !== editingFacility.id)
    .map((f) => ({
      value: f.id,
      label: `${f.code} — ${f.name}`,
    }));

  const createMutation = useMutation({
    mutationFn: (data: ReturnType<typeof formStateToPayload>) =>
      api.createFacility(data),
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
    mutationFn: (data: ReturnType<typeof formStateToPayload>) =>
      api.updateFacility(editingFacility!.id, data),
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

  const handleSubmit = () => {
    if (!form.code.trim() || !form.name.trim() || !form.facility_type) {
      notifications.show({
        title: "Missing fields",
        message: "Code, name, and facility type are required",
        color: "danger",
      });
      return;
    }

    const payload = formStateToPayload(form);

    if (isEdit) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={isEdit ? "Edit Facility" : "Add Facility"}
      size="lg"
      onTransitionEnd={handleOpen}
    >
      <Stack gap="sm">
        <Group grow>
          <TextInput
            label="Code"
            placeholder="FAC-001"
            value={form.code}
            onChange={(e) => updateField("code", e.currentTarget.value)}
            required
          />
          <TextInput
            label="Name"
            placeholder="Main Hospital"
            value={form.name}
            onChange={(e) => updateField("name", e.currentTarget.value)}
            required
          />
        </Group>

        <Group grow>
          <Select
            label="Facility Type"
            data={FACILITY_TYPE_OPTIONS}
            value={form.facility_type}
            onChange={(v) => updateField("facility_type", v)}
            required
            placeholder="Select type..."
          />
          <Select
            label={
              <SelectLabel
                label="Parent Facility"
                onCreate={parentInline.openCreateModal}
              />
            }
            data={parentOptions}
            value={form.parent_id}
            onChange={(v) => updateField("parent_id", v)}
            searchable
            clearable
            placeholder="None (top-level)"
          />
        </Group>

        <TextInput
          label="Address"
          placeholder="123 Medical Lane"
          value={form.address_line1}
          onChange={(e) => updateField("address_line1", e.currentTarget.value)}
        />

        <Group grow>
          <TextInput
            label="City"
            placeholder="Mumbai"
            value={form.city}
            onChange={(e) => updateField("city", e.currentTarget.value)}
          />
          <NumberInput
            label="Bed Count"
            placeholder="100"
            min={0}
            value={form.bed_count}
            onChange={(v) => updateField("bed_count", v)}
          />
        </Group>

        <Group grow>
          <TextInput
            label="Phone"
            placeholder="+91 22 1234 5678"
            value={form.phone}
            onChange={(e) => updateField("phone", e.currentTarget.value)}
          />
          <TextInput
            label="Email"
            placeholder="admin@hospital.com"
            value={form.email}
            onChange={(e) => updateField("email", e.currentTarget.value)}
          />
        </Group>

        <Text size="sm" fw={500} mt="xs">
          Shared Services
        </Text>
        <Group>
          <Switch
            label="Billing"
            checked={form.shared_billing}
            onChange={(e) =>
              updateField("shared_billing", e.currentTarget.checked)
            }
          />
          <Switch
            label="Pharmacy"
            checked={form.shared_pharmacy}
            onChange={(e) =>
              updateField("shared_pharmacy", e.currentTarget.checked)
            }
          />
          <Switch
            label="Lab"
            checked={form.shared_lab}
            onChange={(e) =>
              updateField("shared_lab", e.currentTarget.checked)
            }
          />
          <Switch
            label="HR"
            checked={form.shared_hr}
            onChange={(e) =>
              updateField("shared_hr", e.currentTarget.checked)
            }
          />
        </Group>

        <Group justify="flex-end" mt="md">
          <Button variant="light" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            loading={createMutation.isPending || updateMutation.isPending}
          >
            {isEdit ? "Save" : "Create"}
          </Button>
        </Group>
      </Stack>

      <CreateFacilityModal
        opened={parentInline.createModalOpened}
        onClose={parentInline.closeCreateModal}
        onCreated={parentInline.onCreated}
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
    queryFn: () => api.listFacilities(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteFacility(id),
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
        <Badge
          size="sm"
          variant="light"
          color={FACILITY_TYPE_COLORS[facility.facility_type] ?? "slate"}
        >
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
        <Badge
          size="sm"
          variant="light"
          color={facility.is_active ? "success" : "slate"}
        >
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
        <Button
          size="sm"
          leftSection={<IconPlus size={14} />}
          onClick={openCreate}
        >
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
