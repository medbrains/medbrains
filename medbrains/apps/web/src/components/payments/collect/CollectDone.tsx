import { Group, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { CollectionReceipt, CollectResult } from "@medbrains/types";
import { P, PATIENT_NAME_FIELD_ACCESS_KEYS, PATIENT_UHID_FIELD_ACCESS_KEY } from "@medbrains/types";
import { IconCircleCheck, IconPrinter } from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import { useProtectedFieldAccess } from "@/components/PermissionedFieldValue";
import { Alert, Button, IconButton, Table, Tooltip } from "@/components/ui";
import { printReceiptPacket } from "@/pages/billing/shared";
import { billingService } from "@/services/billing.service";
import { rupees } from "./collect-math";

/** Prints a collection's receipts — one per legal entity — for a user who may print them. */
export function useReceiptPrinter() {
  const canPrint = useHasPermission(P.BILLING.RECEIPTS_PRINT);
  const access = {
    amount: useProtectedFieldAccess("billing.amount"),
    patientAddress: useProtectedFieldAccess("patients.address"),
    patientName: useProtectedFieldAccess(undefined, PATIENT_NAME_FIELD_ACCESS_KEYS),
    uhid: useProtectedFieldAccess(PATIENT_UHID_FIELD_ACCESS_KEY),
  };
  const print = useMutation({
    mutationFn: (receipts: CollectionReceipt[]) =>
      Promise.all(receipts.map((r) => billingService.getReceiptPrintData(r.payment_id))),
    onSuccess: (packets) => {
      for (const packet of packets) printReceiptPacket(packet, access);
    },
  });
  return { canPrint, print };
}

interface CollectDoneProps {
  result: CollectResult;
  outcome: "paid" | "partial";
  change: number;
  printer: ReturnType<typeof useReceiptPrinter>;
  onNext: () => void;
  onClose: () => void;
}

/** After the money is taken: what was received, what is left, the receipts. */
export function CollectDone({
  result,
  outcome,
  change,
  printer,
  onNext,
  onClose,
}: CollectDoneProps) {
  const { canPrint, print } = printer;
  return (
    <Stack gap="md" data-testid="collect-done">
      <Group gap="xs" role="status" aria-live="assertive">
        <IconCircleCheck size={24} aria-hidden="true" />
        <Text fw={700} size="lg">
          {rupees(Number(result.total_amount))} received
          {change > 0 ? ` · change ${rupees(change)}` : ""}
        </Text>
      </Group>
      {outcome === "partial" ? (
        <Alert tone="warning" title="Partly paid">
          The rest stays due on the bill.
        </Alert>
      ) : (
        <Alert tone="success" title="Paid">
          Nothing is left due on these bills.
        </Alert>
      )}
      {print.isError && (
        <Alert tone="danger" title="Receipt not printed">
          {print.error.message}
        </Alert>
      )}
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Receipt</Table.Th>
            <Table.Th>Issued by</Table.Th>
            <Table.Th ta="right">Amount</Table.Th>
            {canPrint && <Table.Th aria-label="Print" />}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {result.receipts.map((r) => (
            <Table.Tr key={r.id} data-testid="row-collect-receipt">
              <Table.Td ff="monospace">{r.receipt_number}</Table.Td>
              <Table.Td>{r.entity_name ?? "Hospital"}</Table.Td>
              <Table.Td ta="right" ff="monospace">
                {rupees(Number(r.amount))}
              </Table.Td>
              {canPrint && (
                <Table.Td>
                  <Tooltip label="Reprint">
                    <IconButton
                      aria-label={`Reprint ${r.receipt_number}`}
                      loading={print.isPending}
                      onClick={() => print.mutate([r])}
                    >
                      <IconPrinter size={16} />
                    </IconButton>
                  </Tooltip>
                </Table.Td>
              )}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      <Group justify="space-between">
        <Button tone="secondary" onClick={onNext}>
          Collect again
        </Button>
        <Button tone="primary" onClick={onClose} data-autofocus>
          Close
        </Button>
      </Group>
    </Stack>
  );
}
