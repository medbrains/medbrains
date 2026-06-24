import { zodResolver } from "@hookform/resolvers/zod";
import { Box, Group, Stack, Text } from "@mantine/core";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import { P, type PatientConsumableIssue, type StoreCatalog } from "@medbrains/types";
import { IconBox, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Alert, Badge, Button, Card, NumberField, Select, Table, toast } from "@/components/ui";

// ── Patient consumables ─────────────────────────────────
//
// Records real store-catalog consumables (gloves, cannulas, IV sets,
// dressings…) consumed during an encounter/admission. Reuses the indent
// `issue_to_patient` primitive: each entry decrements stock AND posts a
// chargeable line onto the patient's bill (one line per item, linked
// back via invoice_item_id). Scoped to the encounter so the same panel
// serves ER visits and IPD admissions. Pharmacy drugs use the separate
// dispensing flow.

const consumableSchema = z.object({
  catalog_item_id: z.string().min(1, "Pick a consumable"),
  quantity: z.number().int("Whole units only").min(1, "Min 1"),
});
type ConsumableFormValues = z.infer<typeof consumableSchema>;

interface PatientConsumablesPanelProps {
  patientId: string;
  /** Scopes the issue + the visit's recorded-consumables list. */
  encounterId: string;
  /** Set for IPD so the issue is tied to the admission too. */
  admissionId?: string;
}

function money(value: string | number): string {
  return `₹${Number(value).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function PatientConsumablesPanel({
  patientId,
  encounterId,
  admissionId,
}: PatientConsumablesPanelProps) {
  const canList = useHasPermission(P.INDENT.CONSUMABLES_LIST);
  const canManage = useHasPermission(P.INDENT.CONSUMABLES_MANAGE);
  const queryClient = useQueryClient();

  const { data: catalog = [] } = useQuery({
    queryKey: ["store-catalog"],
    queryFn: () => api.listStoreCatalog(),
    enabled: canManage,
  });

  const { data: issues = [], isLoading } = useQuery({
    queryKey: ["patient-consumables", encounterId],
    queryFn: () => api.listPatientConsumables({ encounter_id: encounterId }),
    enabled: canList,
  });

  const catalogById = new Map<string, StoreCatalog>(catalog.map((c) => [c.id, c]));

  const options = catalog
    .filter((c) => c.is_active)
    .map((c) => ({
      value: c.id,
      label:
        c.current_stock > 0
          ? `${c.name} · ${money(c.base_price)} / ${c.unit} · stock ${c.current_stock}`
          : `${c.name} · out of stock`,
      disabled: c.current_stock <= 0,
    }));

  const { control, handleSubmit, reset } = useForm<ConsumableFormValues>({
    resolver: zodResolver(consumableSchema),
    defaultValues: { catalog_item_id: "", quantity: 1 },
  });

  const issueMutation = useMutation({
    mutationFn: (values: ConsumableFormValues) => {
      const item = catalogById.get(values.catalog_item_id);
      return api.issueToPatient({
        patient_id: patientId,
        catalog_item_id: values.catalog_item_id,
        encounter_id: encounterId,
        admission_id: admissionId,
        quantity: values.quantity,
        unit_price: item ? Number(item.base_price) : undefined,
        is_chargeable: true,
      });
    },
    onSuccess: () => {
      toast.success("Consumable recorded and billed. Stock decremented.", {
        title: "Consumable added",
      });
      reset({ catalog_item_id: "", quantity: 1 });
      void queryClient.invalidateQueries({ queryKey: ["patient-consumables", encounterId] });
      void queryClient.invalidateQueries({ queryKey: ["store-catalog"] });
    },
    onError: (error: Error) => toast.error(error.message, { title: "Could not record consumable" }),
  });

  if (!canList) return null;

  const lineTotal = (issue: PatientConsumableIssue) =>
    Number(issue.unit_price) * (issue.quantity - issue.returned_qty);
  const billedTotal = issues
    .filter((i) => i.is_chargeable)
    .reduce((sum, i) => sum + lineTotal(i), 0);

  const submit = handleSubmit((values) => issueMutation.mutate(values));

  return (
    <Box id="patient-consumables">
      <Card withBorder>
        <Stack>
          <Group gap="xs">
            <IconBox size={18} />
            <Text fw={700}>Consumables used</Text>
            {issues.length > 0 && <Badge tone="neutral">{issues.length}</Badge>}
          </Group>

          {canManage && (
            <Box component="form" onSubmit={submit}>
              <Group align="flex-end" gap="sm" wrap="wrap">
                <Controller
                  control={control}
                  name="catalog_item_id"
                  render={({ field, fieldState }) => (
                    <Select
                      {...field}
                      label="Consumable"
                      placeholder="Search store catalog…"
                      data={options}
                      searchable
                      error={fieldState.error?.message}
                      style={{ flex: 1, minWidth: 240 }}
                    />
                  )}
                />
                <Controller
                  control={control}
                  name="quantity"
                  render={({ field, fieldState }) => (
                    <NumberField
                      label="Qty"
                      min={1}
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      error={fieldState.error?.message}
                      style={{ width: 110 }}
                    />
                  )}
                />
                <Button
                  type="submit"
                  leftSection={<IconPlus size={14} />}
                  loading={issueMutation.isPending}
                >
                  Add &amp; bill
                </Button>
              </Group>
            </Box>
          )}

          {isLoading ? (
            <Text size="sm" c="dimmed">
              Loading consumables…
            </Text>
          ) : issues.length === 0 ? (
            <Alert tone="info">
              No consumables recorded yet. Items added here decrement stock and post a charge to the
              patient's bill.
            </Alert>
          ) : (
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Item</Table.Th>
                  <Table.Th ta="right">Qty</Table.Th>
                  <Table.Th ta="right">Unit</Table.Th>
                  <Table.Th ta="right">Total</Table.Th>
                  <Table.Th>Billed</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {issues.map((issue) => {
                  const item = catalogById.get(issue.catalog_item_id);
                  return (
                    <Table.Tr key={issue.id}>
                      <Table.Td>
                        <Text size="sm">{item?.name ?? issue.catalog_item_id}</Text>
                        {issue.returned_qty > 0 && (
                          <Text size="xs" c="dimmed">
                            {issue.returned_qty} returned
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td ta="right">{issue.quantity}</Table.Td>
                      <Table.Td ta="right">{money(issue.unit_price)}</Table.Td>
                      <Table.Td ta="right">{money(lineTotal(issue))}</Table.Td>
                      <Table.Td>
                        {!issue.is_chargeable ? (
                          <Badge tone="neutral">Not charged</Badge>
                        ) : issue.invoice_item_id ? (
                          <Badge tone="success">On invoice</Badge>
                        ) : (
                          <Badge tone="warning">Pending bill</Badge>
                        )}
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
              <Table.Tfoot>
                <Table.Tr>
                  <Table.Td colSpan={3} ta="right">
                    <Text fw={700} size="sm">
                      Billable total
                    </Text>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Text fw={700} size="sm">
                      {money(billedTotal)}
                    </Text>
                  </Table.Td>
                  <Table.Td />
                </Table.Tr>
              </Table.Tfoot>
            </Table>
          )}
        </Stack>
      </Card>
    </Box>
  );
}
