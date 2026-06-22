import { zodResolver } from "@hookform/resolvers/zod";
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
import type { MrdStorageCreateInput } from "@medbrains/schemas";
import { mrdStorageCreateSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type { CreateMrdStorageLocationRequest, MrdStorageLocation } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconArchive, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { DataTable } from "@/components";
import type { Column } from "@/components/DataTable";
import { Badge, Button } from "@/components/ui";
import { mrdService } from "@/services/mrd.service";

const STORAGE_DEFAULTS: MrdStorageCreateInput = {
  code: "",
  name: "",
};

export function StorageLocationsTab() {
  const qc = useQueryClient();
  const canManageStorage = useHasPermission(P.MRD.STORAGE_MANAGE);
  const [createOpen, { open: openCreate, close: closeCreate }] = useDisclosure();

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<MrdStorageCreateInput>({
    resolver: zodResolver(mrdStorageCreateSchema),
    defaultValues: STORAGE_DEFAULTS,
    mode: "onTouched",
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
      reset(STORAGE_DEFAULTS);
      closeCreate();
      notifications.show({
        title: "Location created",
        message: "MRD storage location is available for case-sheet filing",
        color: "success",
      });
    },
  });

  const submit = handleSubmit((values) => {
    createMut.mutate({
      code: values.code.trim(),
      name: values.name.trim(),
      building: values.building?.trim() || undefined,
      floor: values.floor?.trim() || undefined,
      room: values.room?.trim() || undefined,
      rack: values.rack?.trim() || undefined,
      shelf: values.shelf?.trim() || undefined,
      bin: values.bin?.trim() || undefined,
      barcode: values.barcode?.trim() || undefined,
      capacity: values.capacity,
      notes: values.notes?.trim() || undefined,
    });
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
            <Controller
              control={control}
              name="code"
              render={({ field }) => (
                <TextInput
                  label="Location Code"
                  placeholder="MRD-A-01"
                  value={field.value ?? ""}
                  onChange={field.onChange}
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
                  placeholder="Compactor A / Rack 1"
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  error={errors.name?.message}
                  required
                />
              )}
            />
          </Group>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <Controller
              control={control}
              name="building"
              render={({ field }) => (
                <TextInput
                  label="Building"
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  error={errors.building?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="floor"
              render={({ field }) => (
                <TextInput
                  label="Floor"
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  error={errors.floor?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="room"
              render={({ field }) => (
                <TextInput
                  label="Room"
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  error={errors.room?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="rack"
              render={({ field }) => (
                <TextInput
                  label="Rack / Compactor"
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  error={errors.rack?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="shelf"
              render={({ field }) => (
                <TextInput
                  label="Shelf"
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  error={errors.shelf?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="bin"
              render={({ field }) => (
                <TextInput
                  label="Bin"
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  error={errors.bin?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="barcode"
              render={({ field }) => (
                <TextInput
                  label="Barcode"
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  error={errors.barcode?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="capacity"
              render={({ field }) => (
                <NumberInput
                  label="Capacity"
                  value={field.value ?? ""}
                  onChange={(v) => field.onChange(v === "" ? undefined : Number(v))}
                  error={errors.capacity?.message}
                  min={1}
                />
              )}
            />
          </SimpleGrid>
          <Controller
            control={control}
            name="notes"
            render={({ field }) => (
              <Textarea
                label="Notes"
                value={field.value ?? ""}
                onChange={field.onChange}
                error={errors.notes?.message}
              />
            )}
          />
          <Button tone="primary" onClick={() => void submit()} loading={createMut.isPending}>
            Create Location
          </Button>
        </Stack>
      </Drawer>
    </>
  );
}
