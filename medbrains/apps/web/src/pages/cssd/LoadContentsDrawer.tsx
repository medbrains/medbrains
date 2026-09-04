/**
 * What went into a sterilisation load — the recall query.
 *
 * When a cycle fails its biological indicator, the only question that matters
 * is which trays were in it, and therefore which patients they reached.
 * `cssd_load_items` had an INSERT and no SELECT anywhere in the codebase, so
 * the load could be filled and never read back: the system held the answer and
 * could not be asked. `addCssdLoadItem` had no caller either, so in practice
 * it held nothing.
 */
import { Group, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { CssdInstrumentSet, CssdLoadItem } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Button, Drawer, NumberField, Select, Table, toast } from "@/components/ui";
import { cssdService } from "@/services/cssd.service";

export function LoadContentsDrawer({
  loadId,
  loadNumber,
  opened,
  onClose,
}: {
  loadId: string | null;
  loadNumber: string | null;
  opened: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const canAdd = useHasPermission(P.CSSD.STERILIZATION_CREATE);
  const [setId, setSetId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState<number>(1);

  const {
    data: items = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["cssd-load-items", loadId],
    queryFn: () => cssdService.listCssdLoadItems(loadId as string),
    enabled: opened && !!loadId,
  });

  const { data: sets = [] } = useQuery({
    queryKey: ["cssd-sets"],
    queryFn: () => cssdService.listCssdSets(),
    enabled: opened,
  });

  const addItem = useMutation({
    mutationFn: () =>
      cssdService.addCssdLoadItem(loadId as string, {
        set_id: setId ?? undefined,
        quantity,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["cssd-load-items", loadId] });
      setSetId(null);
      setQuantity(1);
      toast.success("Added to load");
    },
    onError: (error: Error) => toast.error(error.message, { title: "Could not add to load" }),
  });

  const setName = (id: string | null) =>
    (sets as CssdInstrumentSet[]).find((s) => s.id === id)?.set_name ?? "—";

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title={loadNumber ? `Load ${loadNumber} — contents` : "Load contents"}
      position="right"
      size="md"
    >
      <Stack gap="sm">
        {isError ? (
          // A recall must not read a failed query as an empty tray list.
          <Alert tone="danger" title="Load contents could not be read">
            This is a failed read, not an empty load. Do not treat it as "nothing was in this
            cycle".
          </Alert>
        ) : isLoading ? (
          <Text size="sm" c="dimmed">
            Reading load contents…
          </Text>
        ) : items.length === 0 ? (
          <Text size="sm" c="dimmed">
            Nothing has been recorded in this load yet.
          </Text>
        ) : (
          <Table withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Set</Table.Th>
                <Table.Th>Qty</Table.Th>
                <Table.Th>Pack expiry</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {(items as CssdLoadItem[]).map((item) => (
                <Table.Tr key={item.id}>
                  <Table.Td>{setName(item.set_id)}</Table.Td>
                  <Table.Td>{item.quantity}</Table.Td>
                  <Table.Td>{item.pack_expiry_date ?? "—"}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}

        {canAdd && (
          <Group gap="xs" align="flex-end">
            <Select
              label="Instrument set"
              placeholder="Choose a set"
              data={(sets as CssdInstrumentSet[]).map((s) => ({
                value: s.id,
                label: `${s.set_code} — ${s.set_name}`,
              }))}
              value={setId}
              onChange={setSetId}
              searchable
            />
            <NumberField
              label="Qty"
              min={1}
              value={quantity}
              onChange={(v) => setQuantity(Number(v) || 1)}
            />
            <Button
              tone="primary"
              leftSection={<IconPlus size={14} />}
              disabled={!setId}
              loading={addItem.isPending}
              onClick={() => addItem.mutate()}
            >
              Add to load
            </Button>
          </Group>
        )}
      </Stack>
    </Drawer>
  );
}
