// The registrar's report for one birth or death (Form 1 or Form 2), laid out
// from what the hospital recorded, for entry on the CRS portal. Fields the
// hospital does not hold are named, to be asked of the family and filled on
// the portal. Opening it is a recorded disclosure.

import { Group, Stack, Text } from "@mantine/core";
import type { CrsEvent } from "@medbrains/types";
import { IconPrinter } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { printSheet } from "@/components/Reports/statutory-sheet";
import { Alert, Button, Modal, Table } from "@/components/ui";
import { mrdService } from "@/services/mrd.service";

interface CrsFormModalProps {
  event: CrsEvent;
  onClose: () => void;
}

export function CrsFormModal({ event, onClose }: CrsFormModalProps) {
  const form = useQuery({
    queryKey: ["mrd-crs-form", event.id],
    queryFn: () => mrdService.getCrsForm(event.id),
    // Each fetch is a recorded disclosure: once per opening, never on focus.
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
  });
  const missing = form.data?.fields.filter((f) => f.value === null) ?? [];

  return (
    <Modal opened onClose={onClose} title={form.data?.form ?? "CRS report"} size="lg">
      <Stack gap="sm">
        {form.isError && (
          <Alert tone="danger" title="The report could not be made">
            {form.error.message}
          </Alert>
        )}
        {form.data && (
          <>
            <Text size="sm" c="dimmed">
              Report on the CRS portal by {form.data.due_on}.
            </Text>
            <Table>
              <Table.Tbody>
                {form.data.fields.map((f) => (
                  <Table.Tr key={f.label}>
                    <Table.Td>
                      <Text size="sm">{f.label}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" fw={f.value ? 600 : 400} c={f.value ? undefined : "dimmed"}>
                        {f.value ?? "Ask the family; fill on the portal"}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
            {missing.length > 0 && (
              <Alert
                tone="info"
                title={`${missing.length} field${missing.length === 1 ? "" : "s"} to fill on the portal`}
              >
                {missing.map((f) => f.label).join(" · ")}
              </Alert>
            )}
          </>
        )}
        <Group justify="flex-end">
          <Button tone="ghost" onClick={onClose}>
            Close
          </Button>
          {form.data && (
            <Button
              tone="secondary"
              leftSection={<IconPrinter size={16} />}
              onClick={() =>
                form.data &&
                printSheet(
                  {
                    columns: ["Item", "Entry"],
                    rows: form.data.fields.map((f) => [f.label, f.value ?? ""]),
                  },
                  form.data.form,
                )
              }
            >
              Print
            </Button>
          )}
        </Group>
      </Stack>
    </Modal>
  );
}
