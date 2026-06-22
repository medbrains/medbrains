import {
  Drawer,
  Group,
  NumberInput,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useHasPermission } from "@medbrains/stores";
import type { CreateMrdStorageLocationRequest, MrdStorageLocation } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconArchive, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import type { Column } from "@/components/DataTable";
import { Badge, Button } from "@/components/ui";
import { mrdService } from "@/services/mrd.service";

export function StorageLocationsTab() {
  const qc = useQueryClient();
  const canManageStorage = useHasPermission(P.MRD.STORAGE_MANAGE);
  const [createOpen, { open: openCreate, close: closeCreate }] = useDisclosure();
  const [form, setForm] = useState<CreateMrdStorageLocationRequest>({
    code: "",
    name: "",
  });

  const { data: locations = [], isLoading } = useQuery({
    queryKey: ["mrd-storage-locations"],
    queryFn: () => mrdService.listMrdStorageLocations(),
  });

  const createMut = useMutation({
    mutationFn: (body: CreateMrdStorageLocationRequest) =>
      mrdService.createMrdStorageLocation(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["mrd-storage-locations"] });
      closeCreate();
      setForm({ code: "", name: "" });
      notifications.show({
        title: "Location created",
        message: "MRD storage location is available for case-sheet filing",
        color: "success",
      });
    },
  });

  const columns: Column<MrdStorageLocation>[] = [
    {
      key: "code",
      label: "Code",
      render: (location) => <Text fw={600}>{location.code}</Text>,
    },
    {
      key: "name",
      label: "Location",
      render: (location) => (
        <Stack gap={0}>
          <Text fw={500}>{location.name}</Text>
          <Text size="xs" c="dimmed">
            {[location.building, location.floor, location.room, location.rack, location.shelf]
              .filter(Boolean)
              .join(" / ") || "No physical path"}
          </Text>
        </Stack>
      ),
    },
    {
      key: "barcode",
      label: "Barcode",
      render: (location) => <Text size="sm">{location.barcode ?? "—"}</Text>,
    },
    {
      key: "capacity",
      label: "Capacity",
      render: (location) => (
        <Text size="sm">
          {location.current_count}
          {location.capacity ? ` / ${location.capacity}` : ""}
        </Text>
      ),
    },
    {
      key: "is_active",
      label: "Status",
      render: (location) =>
        location.is_active ? (
          <Badge tone="success">Active</Badge>
        ) : (
          <Badge tone="neutral">Closed</Badge>
        ),
    },
    {
      key: "notes",
      label: "Notes",
      render: (location) => <Text size="sm">{location.notes ?? "—"}</Text>,
    },
  ];

  return (
    <>
      <Group justify="space-between" mb="md">
        <Text size="sm" c="dimmed">
          Configure compactors, racks, shelves, and bins used by MRD filing and retrieval.
        </Text>
        {canManageStorage && (
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={openCreate}>
            Add Location
          </Button>
        )}
      </Group>

      <DataTable
        columns={columns}
        data={locations}
        loading={isLoading}
        rowKey={(location) => location.id}
        emptyIcon={<IconArchive size={32} />}
        emptyTitle="No storage locations"
        emptyDescription="Add MRD compactors, racks, shelves, or bins before filing printed case sheets."
      />

      <Drawer
        opened={createOpen}
        onClose={closeCreate}
        title="Add MRD Storage Location"
        position="right"
        size="xl"
      >
        <Stack>
          <Group grow>
            <TextInput
              label="Location Code"
              placeholder="MRD-A-01"
              value={form.code}
              onChange={(event) => setForm({ ...form, code: event.currentTarget.value })}
              required
            />
            <TextInput
              label="Name"
              placeholder="Compactor A / Rack 1"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.currentTarget.value })}
              required
            />
          </Group>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput
              label="Building"
              value={form.building ?? ""}
              onChange={(event) => setForm({ ...form, building: event.currentTarget.value })}
            />
            <TextInput
              label="Floor"
              value={form.floor ?? ""}
              onChange={(event) => setForm({ ...form, floor: event.currentTarget.value })}
            />
            <TextInput
              label="Room"
              value={form.room ?? ""}
              onChange={(event) => setForm({ ...form, room: event.currentTarget.value })}
            />
            <TextInput
              label="Rack / Compactor"
              value={form.rack ?? ""}
              onChange={(event) => setForm({ ...form, rack: event.currentTarget.value })}
            />
            <TextInput
              label="Shelf"
              value={form.shelf ?? ""}
              onChange={(event) => setForm({ ...form, shelf: event.currentTarget.value })}
            />
            <TextInput
              label="Bin"
              value={form.bin ?? ""}
              onChange={(event) => setForm({ ...form, bin: event.currentTarget.value })}
            />
            <TextInput
              label="Barcode"
              value={form.barcode ?? ""}
              onChange={(event) => setForm({ ...form, barcode: event.currentTarget.value })}
            />
            <NumberInput
              label="Capacity"
              value={form.capacity ?? undefined}
              onChange={(value) =>
                setForm({ ...form, capacity: value ? Number(value) : undefined })
              }
              min={1}
            />
          </SimpleGrid>
          <Textarea
            label="Notes"
            value={form.notes ?? ""}
            onChange={(event) => setForm({ ...form, notes: event.currentTarget.value })}
          />
          <Button
            tone="primary"
            onClick={() => createMut.mutate(form)}
            loading={createMut.isPending}
            disabled={!form.code.trim() || !form.name.trim()}
          >
            Create Location
          </Button>
        </Stack>
      </Drawer>
    </>
  );
}
