import { zodResolver } from "@hookform/resolvers/zod";
import { Box, Group, Stack, Text } from "@mantine/core";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import { type BatchStock, P, type StoreCatalog } from "@medbrains/types";
import { IconReceipt } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Alert, Badge, Button, Card, Modal, NumberField, Table, toast } from "@/components/ui";

// Consignment stock (vendor-owned) — billed on use. Records usage against
// a patient, which decrements the consignment batch AND posts a chargeable
// line (the catalog selling price) so the cost is recovered and the vendor
// can be reconciled. The billing wiring lives in the backend
// record_consignment_usage handler.

const schema = z.object({
  patient_id: z.string().min(1, "Select a patient"),
  quantity: z.number().int().min(1, "Min 1"),
});
type FormValues = z.infer<typeof schema>;

function money(value: string | number): string {
  return `₹${Number(value).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function ConsignmentPanel() {
  const canManage = useHasPermission(P.INDENT.STOCK_MANAGE);
  const queryClient = useQueryClient();
  const [active, setActive] = useState<BatchStock | null>(null);

  const { data: stock = [], isLoading } = useQuery({
    queryKey: ["consignment-stock"],
    queryFn: () => api.listConsignmentStock(),
  });
  const { data: catalog = [] } = useQuery({
    queryKey: ["store-catalog"],
    queryFn: () => api.listStoreCatalog(),
  });
  const catalogById = new Map<string, StoreCatalog>(catalog.map((c) => [c.id, c]));

  const { control, handleSubmit, reset } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { patient_id: "", quantity: 1 },
  });

  const useMutationFn = useMutation({
    mutationFn: (values: FormValues) =>
      api.recordConsignmentUsage({
        batch_stock_id: active?.id ?? "",
        quantity: values.quantity,
        patient_id: values.patient_id,
      }),
    onSuccess: () => {
      toast.success("Consignment usage recorded and billed to the patient.", {
        title: "Usage logged",
      });
      setActive(null);
      reset({ patient_id: "", quantity: 1 });
      void queryClient.invalidateQueries({ queryKey: ["consignment-stock"] });
    },
    onError: (error: Error) => toast.error(error.message, { title: "Could not record usage" }),
  });

  const openUsage = (batch: BatchStock) => {
    reset({ patient_id: "", quantity: 1 });
    setActive(batch);
  };
  const submit = handleSubmit((values) => useMutationFn.mutate(values));
  const activeItem = active ? catalogById.get(active.catalog_item_id) : undefined;

  return (
    <Stack>
      {isLoading ? (
        <Text size="sm" c="dimmed">
          Loading…
        </Text>
      ) : stock.length === 0 ? (
        <Alert tone="info">
          No consignment stock on hand. Vendor-owned batches received as consignment appear here and
          are billed to the patient when used.
        </Alert>
      ) : (
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Item</Table.Th>
              <Table.Th>Batch</Table.Th>
              <Table.Th>Serial</Table.Th>
              <Table.Th ta="right">On hand</Table.Th>
              <Table.Th ta="right">Sell price</Table.Th>
              <Table.Th>Expiry</Table.Th>
              {canManage && <Table.Th />}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {stock.map((batch) => {
              const item = catalogById.get(batch.catalog_item_id);
              return (
                <Table.Tr key={batch.id}>
                  <Table.Td>
                    <Text size="sm">{item?.name ?? batch.catalog_item_id}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" ff="monospace">
                      {batch.batch_number}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{batch.serial_number ?? "—"}</Text>
                  </Table.Td>
                  <Table.Td ta="right">{batch.quantity}</Table.Td>
                  <Table.Td ta="right">{item ? money(item.base_price) : "—"}</Table.Td>
                  <Table.Td>
                    <Text size="sm">{batch.expiry_date ?? "—"}</Text>
                  </Table.Td>
                  {canManage && (
                    <Table.Td>
                      <Button
                        size="xs"
                        tone="secondary"
                        leftSection={<IconReceipt size={14} />}
                        onClick={() => openUsage(batch)}
                      >
                        Record usage
                      </Button>
                    </Table.Td>
                  )}
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      )}

      <Modal
        opened={active !== null}
        onClose={() => setActive(null)}
        title="Record consignment usage"
      >
        <Box component="form" onSubmit={submit}>
          <Stack>
            <Card withBorder p="sm">
              <Group justify="space-between">
                <Text size="sm" fw={600}>
                  {activeItem?.name ?? active?.catalog_item_id}
                </Text>
                <Badge tone="neutral">On hand: {active?.quantity ?? 0}</Badge>
              </Group>
              {activeItem && (
                <Text size="xs" c="dimmed">
                  Bills at {money(activeItem.base_price)} / unit
                </Text>
              )}
            </Card>
            <Controller
              control={control}
              name="patient_id"
              render={({ field, fieldState }) => (
                <Box>
                  <Text size="sm" fw={500} mb={4}>
                    Patient
                  </Text>
                  <PatientSearchSelect value={field.value} onChange={field.onChange} />
                  {fieldState.error && (
                    <Text size="xs" c="red" mt={4}>
                      {fieldState.error.message}
                    </Text>
                  )}
                </Box>
              )}
            />
            <Controller
              control={control}
              name="quantity"
              render={({ field, fieldState }) => (
                <NumberField
                  label="Quantity"
                  min={1}
                  max={active?.quantity}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  error={fieldState.error?.message}
                />
              )}
            />
            <Group justify="flex-end">
              <Button tone="secondary" onClick={() => setActive(null)}>
                Cancel
              </Button>
              <Button type="submit" loading={useMutationFn.isPending}>
                Record &amp; bill
              </Button>
            </Group>
          </Stack>
        </Box>
      </Modal>
    </Stack>
  );
}
