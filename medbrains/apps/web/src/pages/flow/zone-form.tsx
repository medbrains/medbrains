import { zodResolver } from "@hookform/resolvers/zod";
import { Group, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { api } from "@medbrains/api";
import type { FlowConfigZone, FlowFloorSetup, FlowSourceInput } from "@medbrains/types";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { Alert, Button, IconButton, Input, NumberField, Select } from "@/components/ui";

const count = z.number().int().positive().nullable();
const grid = z.number().int().min(1).max(12).nullable();

export const zoneFormSchema = z
  .object({
    capacity: count,
    comfort_limit: count,
    attendant_factor: z.number().min(1).max(5),
    goal_wait_minutes: z.number().int().min(1).max(240).nullable(),
    grid_row: grid,
    grid_col: grid,
    sources: z
      .array(
        z.object({
          kind: z.enum(["department", "token_queue"]),
          department_id: z.string().nullable(),
          token_module: z.string().nullable(),
          counter_label: z.string(),
        }),
      )
      .max(50),
  })
  .refine((v) => v.comfort_limit === null || v.capacity === null || v.comfort_limit <= v.capacity, {
    message: "The comfort limit cannot be above the capacity",
    path: ["comfort_limit"],
  })
  .refine(
    (v) =>
      v.sources.every((s) =>
        s.kind === "department" ? Boolean(s.department_id) : Boolean(s.token_module),
      ),
    { message: "Pick a department, or a queue, for every row", path: ["sources"] },
  );

export type ZoneFormValues = z.infer<typeof zoneFormSchema>;

const asNumber = (v: number | string) => (v === "" || v === null ? null : Number(v));

const KIND_OPTIONS = [
  { value: "department", label: "Department" },
  { value: "token_queue", label: "Token queue" },
];

interface ZoneFormProps {
  zone: FlowConfigZone;
  setup: FlowFloorSetup;
  onSaved: () => void;
}

function toSources(values: ZoneFormValues): FlowSourceInput[] {
  return values.sources.map((s) =>
    s.kind === "department"
      ? { kind: "department", department_id: s.department_id }
      : {
          kind: "token_queue",
          token_module: s.token_module,
          counter_label: s.counter_label.trim() || null,
        },
  );
}

/** A zone's limits, factor, goal, grid place, and what feeds it. */
export function ZoneForm({ zone, setup, onSaved }: ZoneFormProps) {
  const client = useQueryClient();
  const { control, handleSubmit, formState } = useForm<ZoneFormValues>({
    resolver: zodResolver(zoneFormSchema),
    defaultValues: {
      capacity: zone.capacity,
      comfort_limit: zone.comfort_limit,
      attendant_factor: zone.attendant_factor,
      goal_wait_minutes: zone.goal_wait_minutes,
      grid_row: zone.grid_row,
      grid_col: zone.grid_col,
      sources: zone.sources.map((s) => ({
        kind: s.kind,
        department_id: s.department_id,
        token_module: s.token_module,
        counter_label: s.counter_label ?? "",
      })),
    },
  });
  const sources = useFieldArray({ control, name: "sources" });
  const save = useMutation({
    mutationFn: async (values: ZoneFormValues) => {
      const { sources: _ignored, ...limits } = values;
      await api.updateFlowZone(zone.location_id, limits);
      return api.replaceFlowZoneSources(zone.location_id, toSources(values));
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["flow"] });
      onSaved();
    },
  });
  const departments = setup.departments.map((d) => ({ value: d.id, label: d.name }));
  const modules = setup.token_modules.map((m) => ({ value: m, label: m.replace("_", " ") }));
  const numberField = (
    name: Exclude<keyof ZoneFormValues, "sources">,
    label: string,
    extra = {},
  ) => (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <NumberField
          label={label}
          value={field.value ?? ""}
          onChange={(v) => field.onChange(asNumber(v))}
          onBlur={field.onBlur}
          error={fieldState.error?.message}
          {...extra}
        />
      )}
    />
  );

  return (
    <Stack component="form" gap="md" onSubmit={handleSubmit((v) => save.mutate(v))}>
      <SimpleGrid cols={2}>
        {numberField("comfort_limit", "Comfort limit (people)", { min: 1 })}
        {numberField("capacity", "Capacity (people)", { min: 1 })}
        {numberField("attendant_factor", "Attendant factor", {
          min: 1,
          max: 5,
          step: 0.1,
          decimalScale: 2,
          description: "People per patient, with family. 1.8 is the usual Indian OPD estimate.",
        })}
        {numberField("goal_wait_minutes", "Team wait goal (minutes, optional)", {
          min: 1,
          max: 240,
        })}
        {numberField("grid_row", "Map row (1-12)", { min: 1, max: 12 })}
        {numberField("grid_col", "Map column (1-12)", { min: 1, max: 12 })}
      </SimpleGrid>

      <Stack gap="xs">
        <Title order={3} size="h5">
          What feeds this zone
        </Title>
        <Text size="xs" c="dimmed">
          A department brings its checked-in patients, its tokens and its staff on duty. A token
          queue (optionally one counter) brings that queue here even when its department sits
          elsewhere.
        </Text>
        {sources.fields.map((row, i) => (
          <Group key={row.id} align="flex-end" gap="xs" wrap="nowrap">
            <Controller
              control={control}
              name={`sources.${i}.kind`}
              render={({ field }) => (
                <Select
                  label="Kind"
                  data={KIND_OPTIONS}
                  value={field.value}
                  onChange={field.onChange}
                  allowDeselect={false}
                  w={150}
                />
              )}
            />
            <Controller
              control={control}
              name={`sources.${i}.kind`}
              render={({ field: kind }) =>
                kind.value === "department" ? (
                  <Controller
                    control={control}
                    name={`sources.${i}.department_id`}
                    render={({ field }) => (
                      <Select
                        label="Department"
                        data={departments}
                        value={field.value}
                        onChange={field.onChange}
                        searchable
                        flex={1}
                      />
                    )}
                  />
                ) : (
                  <Group gap="xs" flex={1} wrap="nowrap">
                    <Controller
                      control={control}
                      name={`sources.${i}.token_module`}
                      render={({ field }) => (
                        <Select
                          label="Queue"
                          data={modules}
                          value={field.value}
                          onChange={field.onChange}
                          w={150}
                        />
                      )}
                    />
                    <Controller
                      control={control}
                      name={`sources.${i}.counter_label`}
                      render={({ field }) => (
                        <Input label="Counter (optional)" placeholder="e.g. Counter 2" {...field} />
                      )}
                    />
                  </Group>
                )
              }
            />
            <IconButton
              aria-label={`Remove mapping ${i + 1}`}
              tone="danger"
              onClick={() => sources.remove(i)}
            >
              <IconTrash size={16} />
            </IconButton>
          </Group>
        ))}
        {formState.errors.sources?.message && (
          <Text size="sm" c="var(--mb-danger-fg)" role="alert">
            {formState.errors.sources.message}
          </Text>
        )}
        <Button
          tone="tertiary"
          size="xs"
          leftSection={<IconPlus size={16} />}
          onClick={() =>
            sources.append({
              kind: "department",
              department_id: null,
              token_module: null,
              counter_label: "",
            })
          }
        >
          Add a department or queue
        </Button>
      </Stack>

      {save.isError && (
        <Alert tone="danger">
          {save.error instanceof Error ? save.error.message : "The zone was not saved."}
        </Alert>
      )}
      <Group justify="flex-end">
        <Button type="submit" tone="primary" loading={save.isPending}>
          Save zone
        </Button>
      </Group>
    </Stack>
  );
}
