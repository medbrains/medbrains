import { zodResolver } from "@hookform/resolvers/zod";
import { Box, Group, SimpleGrid, Stack, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useHasPermission } from "@medbrains/stores";
import { type ErBay, type ErVisit, P } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import {
  Alert,
  Badge,
  Button,
  Input,
  Modal,
  Switch,
  Table,
  TextArea,
  toast,
} from "@/components/ui";
import { emergencyService } from "@/services/emergency.service";

// ER bay master + live occupancy board. Bays are configurable per
// hospital; occupancy is derived from active visits whose bay_number
// matches a bay code. Gated by emergency.visits perms.

const ACTIVE_STATUSES = new Set(["registered", "triaged", "in_treatment", "observation"]);

const schema = z.object({
  code: z.string().trim().min(1, "Code required"),
  name: z.string().trim().min(1, "Name required"),
  bay_type: z.string().optional(),
  is_active: z.boolean(),
  notes: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = { code: "", name: "", bay_type: "", is_active: true, notes: "" };

export function ErBaysTab() {
  const canView = useHasPermission(P.EMERGENCY.VISITS_LIST);
  const canManage = useHasPermission(P.EMERGENCY.VISITS_UPDATE);
  const queryClient = useQueryClient();
  const [opened, handlers] = useDisclosure(false);
  const [editing, setEditing] = useState<ErBay | null>(null);

  const { data: bays = [], isLoading } = useQuery({
    queryKey: ["er-bays"],
    queryFn: () => emergencyService.listErBays(),
    enabled: canView,
  });
  const { data: visits = [] } = useQuery({
    queryKey: ["er-visits"],
    queryFn: () => emergencyService.listErVisits(),
    enabled: canView,
  });

  const occupancy = useMemo(() => {
    const map = new Map<string, ErVisit[]>();
    for (const v of visits as ErVisit[]) {
      if (!v.bay_number || !ACTIVE_STATUSES.has(v.status)) continue;
      const key = v.bay_number.trim().toLowerCase();
      map.set(key, [...(map.get(key) ?? []), v]);
    }
    return map;
  }, [visits]);

  const occupiedFor = (bay: ErBay) =>
    occupancy.get(bay.code.trim().toLowerCase()) ??
    occupancy.get(bay.name.trim().toLowerCase()) ??
    [];

  const { control, handleSubmit, reset } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY,
  });

  const openCreate = () => {
    setEditing(null);
    reset(EMPTY);
    handlers.open();
  };
  const openEdit = (bay: ErBay) => {
    setEditing(bay);
    reset({
      code: bay.code,
      name: bay.name,
      bay_type: bay.bay_type ?? "",
      is_active: bay.is_active,
      notes: bay.notes ?? "",
    });
    handlers.open();
  };

  const saveMutation = useMutation({
    mutationFn: (values: FormValues) =>
      editing
        ? emergencyService.updateErBay(editing.id, values)
        : emergencyService.createErBay(values),
    onSuccess: () => {
      toast.success("Bay saved.", { title: "Saved" });
      handlers.close();
      void queryClient.invalidateQueries({ queryKey: ["er-bays"] });
    },
    onError: (error: Error) => toast.error(error.message, { title: "Could not save bay" }),
  });

  if (!canView) return null;

  const submit = handleSubmit((values) => saveMutation.mutate(values));
  const totalOccupied = (bays as ErBay[]).filter((b) => occupiedFor(b).length > 0).length;

  return (
    <Stack pt="md">
      <Group justify="space-between">
        <Group gap="xs">
          <Text fw={600}>ER bays</Text>
          {bays.length > 0 && (
            <Badge tone="neutral">
              {totalOccupied}/{bays.length} occupied
            </Badge>
          )}
        </Group>
        {canManage && (
          <Button leftSection={<IconPlus size={14} />} onClick={openCreate}>
            Add bay
          </Button>
        )}
      </Group>

      {isLoading ? (
        <Text size="sm" c="dimmed">
          Loading…
        </Text>
      ) : bays.length === 0 ? (
        <Alert tone="info">
          No ER bays configured. Add your department's bays to track occupancy and assign visits
          consistently.
        </Alert>
      ) : (
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Code</Table.Th>
              <Table.Th>Name</Table.Th>
              <Table.Th>Type</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Occupancy</Table.Th>
              {canManage && <Table.Th />}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {(bays as ErBay[]).map((bay) => {
              const occ = occupiedFor(bay);
              return (
                <Table.Tr key={bay.id}>
                  <Table.Td>
                    <Text size="sm" ff="monospace">
                      {bay.code}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{bay.name}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{bay.bay_type ?? "—"}</Text>
                  </Table.Td>
                  <Table.Td>
                    {bay.is_active ? (
                      <Badge tone="success">Active</Badge>
                    ) : (
                      <Badge tone="neutral">Inactive</Badge>
                    )}
                  </Table.Td>
                  <Table.Td>
                    {occ.length > 0 ? (
                      <Badge tone="warning">Occupied · {occ.length}</Badge>
                    ) : (
                      <Badge tone="success">Free</Badge>
                    )}
                  </Table.Td>
                  {canManage && (
                    <Table.Td>
                      <Button size="xs" tone="secondary" onClick={() => openEdit(bay)}>
                        Edit
                      </Button>
                    </Table.Td>
                  )}
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      )}

      <Modal opened={opened} onClose={handlers.close} title={editing ? "Edit bay" : "Add bay"}>
        <Box component="form" onSubmit={submit}>
          <Stack>
            <SimpleGrid cols={2} spacing="sm">
              <Controller
                control={control}
                name="code"
                render={({ field, fieldState }) => (
                  <Input
                    {...field}
                    label="Code"
                    placeholder="e.g. BAY-1"
                    error={fieldState.error?.message}
                  />
                )}
              />
              <Controller
                control={control}
                name="name"
                render={({ field, fieldState }) => (
                  <Input
                    {...field}
                    label="Name"
                    placeholder="e.g. Resuscitation 1"
                    error={fieldState.error?.message}
                  />
                )}
              />
            </SimpleGrid>
            <Controller
              control={control}
              name="bay_type"
              render={({ field }) => (
                <Input
                  label="Type"
                  placeholder="resus / triage / general / isolation"
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                />
              )}
            />
            <Controller
              control={control}
              name="notes"
              render={({ field }) => (
                <TextArea
                  label="Notes"
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  minRows={2}
                />
              )}
            />
            <Controller
              control={control}
              name="is_active"
              render={({ field }) => (
                <Switch
                  label="Active"
                  checked={field.value}
                  onChange={(e) => field.onChange(e.currentTarget.checked)}
                />
              )}
            />
            <Group justify="flex-end">
              <Button tone="secondary" onClick={handlers.close}>
                Cancel
              </Button>
              <Button type="submit" loading={saveMutation.isPending}>
                Save
              </Button>
            </Group>
          </Stack>
        </Box>
      </Modal>
    </Stack>
  );
}
