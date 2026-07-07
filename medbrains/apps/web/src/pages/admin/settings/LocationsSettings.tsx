import {
  Drawer,
  Group,
  Loader,
  Modal,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { LocationRow } from "@medbrains/types";
import { IconCheck, IconPencil, IconPlus, IconTrash, IconUsers } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { CreateLocationModal, SelectLabel } from "@/components";
import { Badge, Button, IconButton, Table } from "@/components/ui";
import { useCreateInline } from "@/hooks/useCreateInline";
import { settingsSetupService } from "@/services/settingsSetup.service";

// ── Constants ─────────────────────────────────────────────

const LEVEL_OPTIONS = [
  { value: "campus", label: "Campus" },
  { value: "building", label: "Building" },
  { value: "floor", label: "Floor" },
  { value: "wing", label: "Wing" },
  { value: "zone", label: "Zone" },
  { value: "room", label: "Room" },
  { value: "bed", label: "Bed" },
  { value: "station", label: "Nursing station" },
];

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
      settingsSetupService.createLocation(data),
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
    mutationFn: (data: Record<string, unknown>) => {
      if (!editingLocation) throw new Error("No location selected");
      return settingsSetupService.updateLocation(editingLocation.id, data);
    },
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
          label={<SelectLabel label="Parent Location" onCreate={parentInline.openCreateModal} />}
          data={parentOptions}
          value={parentId}
          onChange={setParentId}
          clearable
          searchable
          placeholder={level === "campus" ? "None (root)" : "Select parent location"}
          description={level !== "campus" ? "Required for non-campus locations" : undefined}
        />
        <Group justify="flex-end" mt="md">
          <Button tone="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            tone="primary"
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
          <Button tone="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button tone="danger" onClick={onConfirm} loading={isDeleting}>
            Delete
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

// ── Main Component ────────────────────────────────────────

function LocationStaffDrawer({
  location,
  onClose,
}: {
  location: LocationRow | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [roleLabel, setRoleLabel] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);
  const locId = location?.id ?? "";

  const { data: staff = [] } = useQuery({
    queryKey: ["location-staff", locId],
    queryFn: () => settingsSetupService.listLocationStaff(locId),
    enabled: !!locId,
  });
  const { data: users = [] } = useQuery({
    queryKey: ["setup-users"],
    queryFn: () => settingsSetupService.listSetupUsers(),
    enabled: !!locId,
  });

  const assign = useMutation({
    mutationFn: () =>
      settingsSetupService.assignLocationStaff(locId, {
        user_id: userId ?? "",
        role_label: roleLabel || undefined,
        is_primary: isPrimary,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["location-staff", locId] });
      notifications.show({ message: "Staff assigned" });
      setUserId(null);
      setRoleLabel("");
      setIsPrimary(false);
    },
    onError: (e: Error) => notifications.show({ message: e.message, color: "red" }),
  });
  const remove = useMutation({
    mutationFn: (uid: string) => settingsSetupService.removeLocationStaff(locId, uid),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["location-staff", locId] });
    },
  });

  const userOptions = users.map((u) => ({ value: u.id, label: `${u.full_name} (${u.username})` }));

  return (
    <Drawer
      opened={!!location}
      onClose={onClose}
      title={`Staff — ${location?.name ?? ""}`}
      position="right"
    >
      <Stack gap="md">
        <Stack gap={4}>
          {staff.length === 0 && (
            <Text size="sm" c="dimmed">
              No staff assigned yet.
            </Text>
          )}
          {staff.map((s) => (
            <Group key={s.id} justify="space-between">
              <div>
                <Group gap={6}>
                  <Text size="sm">{s.full_name}</Text>
                  {s.is_primary && (
                    <Badge size="xs" tone="info">
                      Primary
                    </Badge>
                  )}
                </Group>
                <Text size="xs" c="dimmed">
                  {s.role_label || s.role}
                </Text>
              </div>
              <IconButton
                tone="danger"
                aria-label="Remove staff"
                onClick={() => remove.mutate(s.user_id)}
              >
                <IconTrash size={14} />
              </IconButton>
            </Group>
          ))}
        </Stack>

        <Stack gap="sm">
          <Select
            label="User"
            searchable
            data={userOptions}
            value={userId}
            onChange={setUserId}
            placeholder="Select a user"
          />
          <TextInput
            label="Role (optional)"
            value={roleLabel}
            onChange={(e) => setRoleLabel(e.currentTarget.value)}
            placeholder="e.g. charge nurse"
          />
          <Switch
            label="Primary contact"
            checked={isPrimary}
            onChange={(e) => setIsPrimary(e.currentTarget.checked)}
          />
          <Button onClick={() => assign.mutate()} loading={assign.isPending} disabled={!userId}>
            Assign
          </Button>
        </Stack>
      </Stack>
    </Drawer>
  );
}

export function LocationsSettings() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<LocationRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LocationRow | null>(null);
  const [staffLoc, setStaffLoc] = useState<LocationRow | null>(null);

  const { data: locations, isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => settingsSetupService.listLocations(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => settingsSetupService.deleteLocation(id),
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
        <Badge size="sm" tone="neutral">
          {loc.level}
        </Badge>
      </Table.Td>
      <Table.Td>
        <Text size="sm" c="dimmed">
          {getParentName(loc.parent_id)}
        </Text>
      </Table.Td>
      <Table.Td>
        <Badge size="sm" tone={loc.is_active ? "success" : "danger"}>
          {loc.is_active ? "Active" : "Inactive"}
        </Badge>
      </Table.Td>
      <Table.Td>
        <Group gap={4}>
          <IconButton tone="default" onClick={() => setStaffLoc(loc)} aria-label="Manage staff">
            <IconUsers size={16} />
          </IconButton>
          <IconButton tone="primary" onClick={() => openEdit(loc)} aria-label="Edit">
            <IconPencil size={16} />
          </IconButton>
          <IconButton tone="danger" onClick={() => setDeleteTarget(loc)} aria-label="Delete">
            <IconTrash size={16} />
          </IconButton>
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
        <Button tone="primary" size="sm" leftSection={<IconPlus size={14} />} onClick={openCreate}>
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

      <LocationStaffDrawer location={staffLoc} onClose={() => setStaffLoc(null)} />
    </>
  );
}
