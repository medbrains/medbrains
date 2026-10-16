/**
 * A counter return: what the server says may come back, the cashier's choice,
 * then the credit note that was raised and where each strip went.
 */
import { Group, Loader, Stack, Text } from "@mantine/core";
import type { ReturnPosItemsRequest, ReturnResult } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Badge, Button, Modal } from "@/components/ui";
import { pharmacyService } from "@/services/pharmacy.service";
import { PosReturnForm } from "./pos-return-form";
import { formatInr } from "./shared";

interface PosReturnModalProps {
  saleId: string | null;
  onClose: () => void;
}

export function PosReturnModal({ saleId, onClose }: PosReturnModalProps) {
  const queryClient = useQueryClient();
  const [result, setResult] = useState<ReturnResult | null>(null);
  const returnable = useQuery({
    queryKey: ["pharmacy-pos-returnable", saleId],
    queryFn: () => pharmacyService.getPosReturnable(saleId ?? ""),
    enabled: Boolean(saleId),
  });
  const take = useMutation({
    mutationFn: (request: ReturnPosItemsRequest) =>
      pharmacyService.returnPosItems(saleId ?? "", request),
    onSuccess: (done) => {
      setResult(done);
      for (const key of ["pharmacy-pos", "pharmacy-pos-sales", "pharmacy-pos-returnable"]) {
        void queryClient.invalidateQueries({ queryKey: [key] });
      }
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-day-close"] });
    },
  });

  const close = () => {
    setResult(null);
    take.reset();
    onClose();
  };

  return (
    <Modal
      opened={Boolean(saleId)}
      onClose={close}
      size="xl"
      title={
        result
          ? `Credit note ${result.credit_note_number}`
          : `Return items${returnable.data ? ` · ${returnable.data.sale_number}` : ""}`
      }
    >
      {result ? (
        <ReturnDone result={result} onDone={close} />
      ) : returnable.isPending ? (
        <Group gap="xs">
          <Loader size="sm" />
          <Text size="sm">Loading the sale…</Text>
        </Group>
      ) : returnable.isError ? (
        <Alert tone="danger" role="alert" title="Could not load this sale">
          {returnable.error.message}
        </Alert>
      ) : (
        <PosReturnForm
          returnable={returnable.data}
          submitting={take.isPending}
          serverError={take.error?.message ?? null}
          onSubmit={(request) => take.mutate(request)}
          onCancel={close}
        />
      )}
    </Modal>
  );
}

function ReturnDone({ result, onDone }: { result: ReturnResult; onDone: () => void }) {
  return (
    <Stack gap="sm">
      <Alert tone="success" title={`Refund ${formatInr(Number(result.refund_total))}`}>
        Credit note {result.credit_note_number} raised for the {result.business_date} counter day,
        GST of {formatInr(Number(result.gst_reversed))} reversed.
      </Alert>
      {result.refunds.map((part) => (
        <Text key={part.mode} size="sm">
          {part.mode.toUpperCase()}: {formatInr(Number(part.amount))}
          {part.reference ? ` · ref ${part.reference}` : ""}
        </Text>
      ))}
      {result.lines.map((line) => (
        <Group key={line.item_id} justify="space-between">
          <Text size="sm">
            {line.qty} × {line.drug_name}
          </Text>
          <Badge tone={line.destination === "stock" ? "success" : "warning"}>
            {line.destination === "stock" ? "Back to stock" : "To the expiry bin"}
          </Badge>
        </Group>
      ))}
      <Group justify="flex-end">
        <Button tone="primary" onClick={onDone}>
          Done
        </Button>
      </Group>
    </Stack>
  );
}
