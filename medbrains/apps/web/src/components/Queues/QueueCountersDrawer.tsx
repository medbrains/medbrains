import { Group, Stack, Text } from "@mantine/core";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import { P, type QueueRow } from "@medbrains/types";
import { IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import {
  Alert,
  Button,
  Card,
  Drawer,
  IconButton,
  Input,
  MultiSelect,
  Select,
  toast,
} from "@/components/ui";

interface QueueCountersDrawerProps {
  queue: QueueRow | null;
  onClose: () => void;
}

interface CountersForm {
  counters: { station_id: string; staff_user_ids: string[] }[];
}

/** What kind of counter a queue's new counter is, for the station list. */
const STATION_TYPE: Record<string, string> = {
  pharmacy: "pharmacy_counter",
  billing: "billing_counter",
  lab: "lab_counter",
  opd: "opd_counter",
  registration: "reception",
};

const stationCode = (name: string) =>
  `${
    name
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 20) || "COUNTER"
  }-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;

/**
 * The counters — windows, rooms, desks — a queue calls patients to, and who
 * may call at each. With none, the queue calls as before; with some, every
 * call names one, so the board can say which window to go to.
 */
export function QueueCountersDrawer({ queue, onClose }: QueueCountersDrawerProps) {
  const queryClient = useQueryClient();
  const canListStations = useHasPermission(P.ADMIN.SETTINGS_LOCATIONS_LIST);
  const canCreateStation = useHasPermission(P.ADMIN.SETTINGS_LOCATIONS_CREATE);
  const canListUsers = useHasPermission(P.ADMIN.USERS_LIST);
  const [newName, setNewName] = useState("");
  const open = Boolean(queue);

  const counters = useQuery({
    queryKey: ["queue-counters", queue?.id],
    queryFn: () => api.listQueueCounters(queue?.id ?? ""),
    enabled: open,
  });
  const stations = useQuery({
    queryKey: ["stations"],
    queryFn: () => api.listStations(),
    enabled: open && canListStations,
  });
  const users = useQuery({
    queryKey: ["setup-users"],
    queryFn: () => api.listSetupUsers(),
    enabled: open && canListUsers,
  });

  const { control, handleSubmit } = useForm<CountersForm>({
    values: {
      counters: (counters.data ?? []).map((c) => ({
        station_id: c.station_id,
        staff_user_ids: c.staff_user_ids,
      })),
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "counters" });

  const stationOptions = (stations.data ?? [])
    .filter((s) => s.is_active)
    .map((s) => ({ value: s.id, label: s.name }));
  const staffOptions = (users.data ?? [])
    .filter((u) => u.is_active)
    .map((u) => ({ value: u.id, label: `${u.full_name} · ${u.role.replaceAll("_", " ")}` }));

  const create = useMutation({
    mutationFn: () =>
      api.createStation({
        code: stationCode(newName),
        name: newName.trim(),
        station_type: STATION_TYPE[queue?.module ?? ""] ?? "other",
      }),
    onSuccess: (station) => {
      void queryClient.invalidateQueries({ queryKey: ["stations"] });
      append({ station_id: station.id, staff_user_ids: [] });
      setNewName("");
    },
    onError: (error: Error) => toast.error(error.message, { title: "Counter not created" }),
  });

  const save = useMutation({
    mutationFn: (values: CountersForm) =>
      api.replaceQueueCounters(queue?.id ?? "", values.counters),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["queue-counters", queue?.id] });
      toast.success("Counters saved");
      onClose();
    },
    onError: (error: Error) => toast.error(error.message, { title: "Counters not saved" }),
  });

  return (
    <Drawer opened={open} onClose={onClose} title={`Counters — ${queue?.name ?? ""}`} size="lg">
      <form onSubmit={handleSubmit((values) => save.mutate(values))}>
        <Stack gap="md">
          <Text size="sm">
            The windows, rooms or desks this queue calls patients to. Once you add one, every call
            names a counter, and the board shows it.
          </Text>
          {counters.isError && <Alert tone="danger">Could not load this queue's counters.</Alert>}
          {(stations.isError || !canListStations) && (
            <Alert tone="warning">
              You cannot see the hospital's counters, so none can be added.
            </Alert>
          )}
          {counters.isSuccess && fields.length === 0 && (
            <Text size="sm" c="dimmed">
              No counters — calls do not name a counter.
            </Text>
          )}
          {fields.map((field, index) => (
            <Card key={field.id} data-testid={`row-counter-${index}`}>
              <Group align="flex-end" wrap="nowrap" gap="xs">
                <Controller
                  control={control}
                  name={`counters.${index}.station_id`}
                  render={({ field: station }) => (
                    <Select
                      label="Counter"
                      data={stationOptions}
                      value={station.value || null}
                      onChange={(value) => station.onChange(value ?? "")}
                      searchable
                      style={{ flex: 1 }}
                      data-testid={`picker-counter-${index}`}
                    />
                  )}
                />
                <Controller
                  control={control}
                  name={`counters.${index}.staff_user_ids`}
                  render={({ field: staff }) => (
                    <MultiSelect
                      label="Only these staff call here"
                      placeholder={staff.value.length ? undefined : "Anyone on this queue"}
                      data={staffOptions}
                      value={staff.value}
                      onChange={staff.onChange}
                      searchable
                      disabled={!canListUsers}
                      style={{ flex: 2 }}
                      data-testid={`picker-counter-staff-${index}`}
                    />
                  )}
                />
                <IconButton
                  aria-label={`Remove counter ${index + 1}`}
                  tone="danger"
                  onClick={() => remove(index)}
                >
                  <IconTrash size={16} />
                </IconButton>
              </Group>
            </Card>
          ))}
          <Button
            tone="tertiary"
            onClick={() => append({ station_id: "", staff_user_ids: [] })}
            disabled={!canListStations}
            data-testid="btn-add-counter"
          >
            Add an existing counter
          </Button>
          {canCreateStation && (
            <Group align="flex-end" gap="xs">
              <Input
                label="New counter"
                placeholder="e.g. Window 3"
                value={newName}
                onChange={(event) => setNewName(event.currentTarget.value)}
                style={{ flex: 1 }}
                data-testid="field-new-counter"
              />
              <Button
                tone="secondary"
                onClick={() => create.mutate()}
                loading={create.isPending}
                disabled={!newName.trim()}
                data-testid="btn-create-counter"
              >
                Create and add
              </Button>
            </Group>
          )}
          <Group justify="flex-end">
            <Button tone="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              tone="primary"
              type="submit"
              loading={save.isPending}
              data-testid="btn-save-counters"
            >
              Save counters
            </Button>
          </Group>
        </Stack>
      </form>
    </Drawer>
  );
}
