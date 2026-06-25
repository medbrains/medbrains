import { zodResolver } from "@hookform/resolvers/zod";
import { Box, Group, SimpleGrid, Stack, Text } from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import { type ImplantRegistryEntry, type OtBooking, P, type StoreCatalog } from "@medbrains/types";
import { IconPlus, IconTool } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Alert, Badge, Button, Card, Input, Select, Table, TextArea, toast } from "@/components/ui";

// OT implant register — NABH-27 traceability. Implants used in a case are
// recorded into the shared implant_registry (serial, manufacturer, model,
// warranty, site) keyed to the patient + surgeon, so a recall can identify
// every affected patient. Reuses the existing indent implant-registry API.

const schema = z.object({
  catalog_item_id: z.string().min(1, "Pick an implant"),
  serial_number: z.string().optional(),
  implant_site: z.string().optional(),
  manufacturer: z.string().optional(),
  model_number: z.string().optional(),
  warranty_expiry: z.date().nullable().optional(),
  notes: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = { catalog_item_id: "" };

function dateOf(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString("en-IN") : "—";
}

export function OtImplantRegisterPanel({ booking }: { booking: OtBooking }) {
  const canView = useHasPermission(P.INDENT.IMPLANTS_LIST);
  const canManage = useHasPermission(P.INDENT.IMPLANTS_MANAGE);
  const queryClient = useQueryClient();

  const { data: catalog = [] } = useQuery({
    queryKey: ["store-catalog"],
    queryFn: () => api.listStoreCatalog(),
    enabled: canManage,
  });
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["implant-registry", booking.patient_id],
    queryFn: () => api.listImplantRegistry({ patient_id: booking.patient_id }),
    enabled: canView,
  });

  const catalogById = new Map<string, StoreCatalog>(catalog.map((c) => [c.id, c]));
  const options = catalog
    .filter((c) => c.is_implant && c.is_active)
    .map((c) => ({ value: c.id, label: c.name }));

  const { control, handleSubmit, reset } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY,
  });

  const addMutation = useMutation({
    mutationFn: (values: FormValues) =>
      api.createImplantEntry({
        catalog_item_id: values.catalog_item_id,
        patient_id: booking.patient_id,
        surgeon_id: booking.primary_surgeon_id,
        implant_date: new Date().toISOString().slice(0, 10),
        serial_number: values.serial_number || undefined,
        implant_site: values.implant_site || undefined,
        manufacturer: values.manufacturer || undefined,
        model_number: values.model_number || undefined,
        warranty_expiry: values.warranty_expiry
          ? values.warranty_expiry.toISOString().slice(0, 10)
          : undefined,
        notes: values.notes || undefined,
      }),
    onSuccess: () => {
      toast.success("Implant recorded to the registry.", { title: "Logged" });
      reset(EMPTY);
      void queryClient.invalidateQueries({ queryKey: ["implant-registry", booking.patient_id] });
    },
    onError: (error: Error) => toast.error(error.message, { title: "Could not record implant" }),
  });

  if (!canView) return null;

  const submit = handleSubmit((values) => addMutation.mutate(values));
  const itemName = (e: ImplantRegistryEntry) =>
    catalogById.get(e.catalog_item_id)?.name ?? e.catalog_item_id;

  return (
    <Box id="ot-implants">
      <Card withBorder>
        <Stack>
          <Group gap="xs">
            <IconTool size={18} />
            <Text fw={700}>Implant register</Text>
            {entries.length > 0 && <Badge tone="neutral">{entries.length}</Badge>}
          </Group>

          {canManage && (
            <Box component="form" onSubmit={submit}>
              <Stack gap="sm">
                <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
                  <Controller
                    control={control}
                    name="catalog_item_id"
                    render={({ field, fieldState }) => (
                      <Select
                        {...field}
                        label="Implant"
                        placeholder="Select implant catalog item…"
                        data={options}
                        searchable
                        error={fieldState.error?.message}
                      />
                    )}
                  />
                  <Controller
                    control={control}
                    name="serial_number"
                    render={({ field }) => (
                      <Input
                        label="Serial / lot number"
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                      />
                    )}
                  />
                  <Controller
                    control={control}
                    name="manufacturer"
                    render={({ field }) => (
                      <Input
                        label="Manufacturer"
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                      />
                    )}
                  />
                  <Controller
                    control={control}
                    name="model_number"
                    render={({ field }) => (
                      <Input
                        label="Model number"
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                      />
                    )}
                  />
                  <Controller
                    control={control}
                    name="implant_site"
                    render={({ field }) => (
                      <Input
                        label="Implant site"
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                      />
                    )}
                  />
                  <Controller
                    control={control}
                    name="warranty_expiry"
                    render={({ field }) => (
                      <DatePickerInput
                        label="Warranty expiry"
                        value={field.value ?? null}
                        onChange={field.onChange}
                        clearable
                      />
                    )}
                  />
                </SimpleGrid>
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
                <Group>
                  <Button
                    type="submit"
                    leftSection={<IconPlus size={14} />}
                    loading={addMutation.isPending}
                  >
                    Record implant
                  </Button>
                </Group>
              </Stack>
            </Box>
          )}

          {isLoading ? (
            <Text size="sm" c="dimmed">
              Loading…
            </Text>
          ) : entries.length === 0 ? (
            <Alert tone="info">
              No implants on record for this patient. Implants recorded here are traceable for
              recall (serial, manufacturer, warranty).
            </Alert>
          ) : (
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Implant</Table.Th>
                  <Table.Th>Serial / lot</Table.Th>
                  <Table.Th>Make / model</Table.Th>
                  <Table.Th>Site</Table.Th>
                  <Table.Th>Implanted</Table.Th>
                  <Table.Th>Warranty</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {entries.map((e) => (
                  <Table.Tr key={e.id}>
                    <Table.Td>
                      <Text size="sm">{itemName(e)}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" ff="monospace">
                        {e.serial_number ?? "—"}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">
                        {[e.manufacturer, e.model_number].filter(Boolean).join(" · ") || "—"}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{e.implant_site ?? "—"}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{dateOf(e.implant_date)}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{dateOf(e.warranty_expiry)}</Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Stack>
      </Card>
    </Box>
  );
}
