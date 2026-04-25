import { useEffect, useState } from "react";
import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Loader,
  Modal,
  Select,
  Stack,
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
import type { LocationRow } from "@medbrains/types";
import { SelectLabel, CreateLocationModal } from "../../../components";
import { useCreateInline } from "../../../hooks/useCreateInline";

// ── Constants ─────────────────────────────────────────────

const LEVEL_OPTIONS = [
  { value: "campus", label: "Campus" },
  { value: "building", label: "Building" },
  { value: "floor", label: "Floor" },
  { value: "wing", label: "Wing" },
  { value: "zone", label: "Zone" },
  { value: "room", label: "Room" },
  { value: "bed", label: "Bed" },
];

const LEVEL_COLORS: Record<string, string> = {
  campus: "primary",
  building: "violet",
  floor: "info",
  wing: "teal",
  zone: "orange",
  room: "success",
  bed: "slate",
};

const QUERY_KEY = ["setup-locations"];

// ── Location Modal ────────────────────────────────────────

function LocationModal({
  opened,
  onClose,
  editingLocation,
  locations,
}: {
  opened: boolean;
  onClose: () => void;
  editingLocation: LocationRow | null;
  locations: LocationRow[];
}) {
  const queryClient = useQueryClient();
  const isEdit = !!editingLocation;

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [level, setLevel] = useState<string>("campus");
  const [parentId, setParentId] = useState<string | null>(null);

  const parentInline = useCreateInline<LocationRow>({ queryKey: QUERY_KEY });

  useEffect(() => {
    if (parentInline.pendingSelect) {
      setParentId(parentInline.pendingSelect.id);
      parentInline.clearPendingSelect();
    }
  }, [parentInline.pendingSelect, parentInline.clearPendingSelect]);

  const handleOpen = () => {
    if (editingLocation) {
      setCode(editingLocation.code);
      setName(editingLocation.name);
      setLevel(editingLocation.level);
      setParentId(editingLocation.parent_id);
    } else {
      setCode("");
      setName("");
      setLevel("campus");
      setParentId(null);
    }
  };

  const parentOptions = locations
    .filter((l) => l.id !== editingLocation?.id)
    .map((l) => ({
      value: l.id,
      label: `${l.name} (${l.level})`,
    }));

  const createMutation = useMutation({
    mutationFn: (data: { code: string; name: string; level: string; parent_id?: string }) =>
      api.createLocation(data),
    onSuccess: () => {
      notifications.show({
        title: "Location created",
        message: "Location has been created successfully",
        color: "success",
        icon: <IconCheck size={16} />,
      });
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
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
    mutationFn: (data: Record<string, unknown>) =>
      api.updateLocation(editingLocation!.id, data),
    onSuccess: () => {
      notifications.show({
        title: "Location updated",
        message: "Location has been updated successfully",
        color: "success",
        icon: <IconCheck size={16} />,
      });
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
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
    if (!code.trim() || !name.trim()) {
      notifications.show({
        title: "Validation error",
        message: "Code and Name are required",
        color: "danger",
      });
      return;
    }

    if (isEdit) {
      updateMutation.mutate({
        name,
        level,
        parent_id: parentId ?? undefined,
      });
    } else {
      createMutation.mutate({
        code,
        name,
        level,
        parent_id: parentId ?? undefined,
      });
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={isEdit ? "Edit Location" : "Add Location"}
      size="md"
      onTransitionEnd={handleOpen}
    >
      <Stack gap="sm">
        <TextInput
          label="Code"
          placeholder="MAIN-CAMPUS"
          value={code}
          onChange={(e) => setCode(e.currentTarget.value.toUpperCase())}
          disabled={isEdit}
          required
        />
        <TextInput
          label="Name"
          placeholder="Main Campus"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          required
        />
        <Select
          label="Level"
          data={LEVEL_OPTIONS}
          value={level}
          onChange={(v) => setLevel(v ?? "campus")}
          required
        />
        <Select
          label={
            <SelectLabel
              label="Parent Location"
              onCreate={parentInline.openCreateModal}
            />
          }
          data={parentOptions}
          value={parentId}
          onChange={setParentId}
          clearable
          searchable
          placeholder={level === "campus" ? "None (root)" : "Select parent location"}
          description={level !== "campus" ? "Required for non-campus locations" : undefined}
        />
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

      <CreateLocationModal
        opened={parentInline.createModalOpened}
        onClose={parentInline.closeCreateModal}
        onCreated={parentInline.onCreated}
      />
    </Modal>
  );
}

// ── Delete Confirmation Modal ─────────────────────────────

function DeleteConfirmModal({
  opened,
  onClose,
  location,
  onConfirm,
  isDeleting,
}: {
  opened: boolean;
  onClose: () => void;
  location: LocationRow | null;
  onConfirm: () => void;
  isDeleting: boolean;
}) {
  return (
    <Modal opened={opened} onClose={onClose} title="Delete Location" size="sm">
      <Stack gap="md">
        <Text size="sm">
          Are you sure you want to delete location{" "}
          <Text span fw={600}>
            {location?.name}
          </Text>{" "}
          ({location?.code})? This action cannot be undone.
        </Text>
        <Group justify="flex-end">
          <Button variant="light" onClick={onClose}>
            Cancel
          </Button>
          <Button color="danger" onClick={onConfirm} loading={isDeleting}>
            Delete
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

// ── Main Component ────────────────────────────────────────

export function LocationsSettings() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<LocationRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LocationRow | null>(null);

  const { data: locations, isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => api.listLocations(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteLocation(id),
    onSuccess: () => {
      notifications.show({
        title: "Location deleted",
        message: "Location has been deleted successfully",
        color: "success",
        icon: <IconCheck size={16} />,
      });
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      setDeleteTarget(null);
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
    setEditingLocation(null);
    setModalOpen(true);
  };

  const openEdit = (location: LocationRow) => {
    setEditingLocation(location);
    setModalOpen(true);
  };

  const getParentName = (parentId: string | null): string => {
    if (!parentId || !locations) return "-";
    const parent = locations.find((l) => l.id === parentId);
    return parent ? `${parent.name} (${parent.level})` : "-";
  };

  if (isLoading) {
    return (
      <Stack align="center" py="xl">
        <Loader size="md" />
        <Text size="sm" c="dimmed">
          Loading locations...
        </Text>
      </Stack>
    );
  }

  const rows = (locations ?? []).map((loc) => (
    <Table.Tr key={loc.id}>
      <Table.Td>
        <Text size="sm" ff="monospace" fw={500}>
          {loc.code}
        </Text>
      </Table.Td>
      <Table.Td>
        <Text size="sm">{loc.name}</Text>
      </Table.Td>
      <Table.Td>
        <Badge size="sm" variant="light" color={LEVEL_COLORS[loc.level] ?? "slate"}>
          {loc.level}
        </Badge>
      </Table.Td>
      <Table.Td>
        <Text size="sm" c="dimmed">
          {getParentName(loc.parent_id)}
        </Text>
      </Table.Td>
      <Table.Td>
        <Badge size="sm" variant="light" color={loc.is_active ? "success" : "danger"}>
          {loc.is_active ? "Active" : "Inactive"}
        </Badge>
      </Table.Td>
      <Table.Td>
        <Group gap={4}>
          <ActionIcon variant="subtle" color="primary" onClick={() => openEdit(loc)} aria-label="Edit">
            <IconPencil size={16} />
          </ActionIcon>
          <ActionIcon variant="subtle" color="danger" onClick={() => setDeleteTarget(loc)} aria-label="Delete">
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
          Locations
        </Text>
        <Button size="sm" leftSection={<IconPlus size={14} />} onClick={openCreate}>
          Add Location
        </Button>
      </Group>

      {(locations ?? []).length === 0 ? (
        <Text size="sm" c="dimmed" ta="center" py="xl">
          No locations configured. Add your first location to get started.
        </Text>
      ) : (
        <Table striped highlightOnHover withTableBorder withColumnBorders>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Code</Table.Th>
              <Table.Th>Name</Table.Th>
              <Table.Th>Level</Table.Th>
              <Table.Th>Parent</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th w={100}>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>{rows}</Table.Tbody>
        </Table>
      )}

      <LocationModal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        editingLocation={editingLocation}
        locations={locations ?? []}
      />

      <DeleteConfirmModal
        opened={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        location={deleteTarget}
        onConfirm={() => {
          if (deleteTarget) {
            deleteMutation.mutate(deleteTarget.id);
          }
        }}
        isDeleting={deleteMutation.isPending}
      />
    </>
  );
}
