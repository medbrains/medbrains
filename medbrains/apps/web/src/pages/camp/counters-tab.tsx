import { Group, Stack, Text } from "@mantine/core";
import type { AddCampCounterRequest, CampCounter, DepartmentRow } from "@medbrains/types";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { type Column, DataTable } from "@/components";
import { Alert, Button, IconButton, Input, NumberField, Select, toast } from "@/components/ui";
import { campService } from "@/services/camp.service";
import { lookupsService } from "@/services/lookups.service";

/**
 * The camp's service points — which room or desk serves which department.
 *
 * The TV camp board is built entirely from these rows: it selects
 * `FROM camp_department_counters JOIN departments`, so with none of them it
 * answers an empty array no matter how complete the board is. That board has
 * been finished and unreachable, because the only code that ever wrote these
 * tables reads a camp plan the schema no longer has.
 */
export function CountersTab({ campId, canUpdate }: { campId: string; canUpdate: boolean }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [location, setLocation] = useState("");
  const [capacity, setCapacity] = useState<number | string>(0);

  const {
    data: counters = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["camp-counters", campId],
    queryFn: () => campService.listCampCounters(campId),
  });

  const { data: departments = [] } = useQuery({
    queryKey: ["departments", "active"],
    queryFn: () => lookupsService.listDepartments(),
  });

  const add = useMutation({
    mutationFn: (data: AddCampCounterRequest) => campService.addCampCounter(campId, data),
    onSuccess: (created) => {
      void qc.invalidateQueries({ queryKey: ["camp-counters", campId] });
      toast.success(`${created.counter_name} added to the camp board`, { title: "Counter added" });
      setName("");
      setLocation("");
      setCapacity(0);
    },
    onError: (error: Error) => toast.error(error.message, { title: "Could not add counter" }),
  });

  const remove = useMutation({
    mutationFn: (counterId: string) => campService.removeCampCounter(campId, counterId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["camp-counters", campId] });
      toast.success("Counter retired", { title: "Removed" });
    },
    onError: (error: Error) => toast.error(error.message, { title: "Could not remove counter" }),
  });

  const columns: Column<CampCounter>[] = [
    {
      key: "counter_name",
      label: "Counter",
      render: (row) => <Text size="sm">{row.counter_name}</Text>,
    },
    {
      key: "department_name",
      label: "Serves",
      // An unmapped counter is the one case worth calling out: it exists, and
      // it will never appear on the board.
      render: (row) =>
        row.department_name ? (
          <Text size="sm">{row.department_name}</Text>
        ) : (
          <Text size="sm" c="red">
            Not on the board — no department
          </Text>
        ),
    },
    {
      key: "location_label",
      label: "Where",
      render: (row) => <Text size="sm">{row.location_label ?? "—"}</Text>,
    },
    {
      key: "capacity_per_hour",
      label: "Per hour",
      render: (row) => <Text size="sm">{row.capacity_per_hour || "—"}</Text>,
    },
    {
      key: "actions",
      label: "",
      render: (row) =>
        canUpdate ? (
          <IconButton
            tone="danger"
            aria-label={`Retire ${row.counter_name}`}
            onClick={() => remove.mutate(row.id)}
          >
            <IconTrash size={16} />
          </IconButton>
        ) : null,
    },
  ];

  // An outage must not read as "this camp has no counters": that is what sends
  // someone to create a second set of rooms that already exist.
  if (isError) {
    return (
      <Alert tone="danger" title="Counters could not be loaded">
        The camp's counters are unavailable. This is not the same as the camp having none — do not
        set them up again until this list loads.
      </Alert>
    );
  }

  return (
    <Stack>
      {canUpdate && (
        <Group align="flex-end" gap="sm">
          <Input
            label="Counter"
            placeholder="Consultation room 1"
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
          />
          <Select
            label="Serves department"
            placeholder="Which department"
            data={(departments as DepartmentRow[]).map((d) => ({ value: d.id, label: d.name }))}
            value={departmentId}
            onChange={(value) => setDepartmentId(value ?? "")}
            searchable
          />
          <Input
            label="Where"
            placeholder="School block A"
            value={location}
            onChange={(event) => setLocation(event.currentTarget.value)}
          />
          <NumberField
            label="Patients per hour"
            min={0}
            w={140}
            value={capacity}
            onChange={setCapacity}
          />
          <Button
            tone="primary"
            leftSection={<IconPlus size={16} />}
            loading={add.isPending}
            disabled={!name.trim() || !departmentId}
            onClick={() =>
              add.mutate({
                counter_name: name.trim(),
                department_id: departmentId,
                location_label: location.trim() || undefined,
                capacity_per_hour: Number(capacity) || 0,
              })
            }
          >
            Add counter
          </Button>
        </Group>
      )}

      <Text size="sm" c="dimmed">
        The camp board shows one card per counter. A camp with no counters shows an empty board.
      </Text>

      <DataTable columns={columns} data={counters} loading={isLoading} rowKey={(row) => row.id} />
    </Stack>
  );
}
