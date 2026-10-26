/**
 * Analyser results that could not be matched to exactly one order -- no
 * barcode, a barcode on two orders, a different patient, a conflicting value.
 * They are held here rather than guessed onto an order.
 */
import { Stack, Text } from "@mantine/core";
import type { HeldAnalyserMessage } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Button, Table } from "@/components/ui";
import { labService } from "@/services/lab.service";
import { AnalyserReviewModal } from "./AnalyserReviewModal";

export function AnalyserReviewTab() {
  const [open, setOpen] = useState<HeldAnalyserMessage | null>(null);
  const held = useQuery({
    queryKey: ["analyser-review"],
    queryFn: () => labService.listHeldAnalyserResults(),
  });

  return (
    <Stack gap="sm">
      <Text size="sm" c="dimmed">
        Results an analyser sent that could not be matched to one order with certainty. Attach each
        to the right order or dismiss it with a reason.
      </Text>
      {held.isError && (
        <Alert tone="danger" title="Held results could not be loaded">
          {(held.error as Error).message}
        </Alert>
      )}
      {held.data?.length === 0 && (
        <Text size="sm">No analyser results are waiting for review.</Text>
      )}
      {!!held.data?.length && (
        <Table aria-label="Held analyser results">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Received</Table.Th>
              <Table.Th>Analyser</Table.Th>
              <Table.Th>Sample</Table.Th>
              <Table.Th>Results</Table.Th>
              <Table.Th>Why held</Table.Th>
              <Table.Th>Action</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {held.data.map((m) => (
              <Table.Tr key={m.id}>
                <Table.Td>{new Date(m.created_at).toLocaleString()}</Table.Td>
                <Table.Td>{m.device_name}</Table.Td>
                <Table.Td>{m.mapped_data?.identifiers?.sample_barcode ?? "No barcode"}</Table.Td>
                <Table.Td>{m.mapped_data?.results?.length ?? 0}</Table.Td>
                <Table.Td>{m.reason ?? "—"}</Table.Td>
                <Table.Td>
                  <Button tone="primary" onClick={() => setOpen(m)}>
                    Review
                  </Button>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
      <AnalyserReviewModal message={open} onClose={() => setOpen(null)} />
    </Stack>
  );
}
