// Apply a credit note against one of the same patient's open invoices.
//
// The note carries only its source invoice, so the patient is read from that
// invoice and the picker offers that patient's payable invoices — never a
// typed invoice id.

import { Stack, Text } from "@mantine/core";
import type { CreditNote } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Modal, Select, toast } from "@/components/ui";
import { billingService } from "@/services/billing.service";
import { invoiceIsPayable } from "./shared";

interface ApplyCreditNoteModalProps {
  note: CreditNote;
  onClose: () => void;
}

export function ApplyCreditNoteModal({ note, onClose }: ApplyCreditNoteModalProps) {
  const queryClient = useQueryClient();
  const [invoiceId, setInvoiceId] = useState<string | null>(null);

  const source = useQuery({
    queryKey: ["billing", "invoice", note.invoice_id],
    queryFn: () => billingService.getInvoice(note.invoice_id),
  });
  const patientId = source.data?.invoice.patient_id;

  const candidates = useQuery({
    queryKey: ["billing", "credit-note-invoices", patientId],
    queryFn: () => billingService.listInvoices({ patient_id: patientId ?? "" }),
    enabled: Boolean(patientId),
  });

  const options = (candidates.data?.invoices ?? []).filter(invoiceIsPayable).map((inv) => ({
    value: inv.id,
    label: `${inv.invoice_number} · ₹${inv.total_amount} (paid ₹${inv.paid_amount})`,
  }));

  const apply = useMutation({
    mutationFn: (target: string) => billingService.applyCreditNote(note.id, target),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["credit-notes"] });
      toast.success(`Credit note ${note.credit_note_number} applied`);
      onClose();
    },
    onError: (err: Error) => toast.error(err.message, { title: "Could not apply credit note" }),
  });

  const loadFailed = source.isError || candidates.isError;
  const loading = source.isLoading || candidates.isLoading;

  return (
    <Modal
      opened
      onClose={onClose}
      title={`Apply credit note ${note.credit_note_number}`}
      primaryAction={{
        label: "Apply",
        onClick: () => invoiceId && apply.mutate(invoiceId),
        loading: apply.isPending,
        disabled: !invoiceId,
      }}
      secondaryAction={{ label: "Cancel", onClick: onClose }}
    >
      <Stack gap="sm">
        <Text size="sm">Credit of ₹{note.amount} will be set against the invoice you choose.</Text>
        {loadFailed ? (
          <Alert tone="danger" title="Invoices could not be loaded">
            Close this dialog and try again.
          </Alert>
        ) : (
          <Select
            label="Invoice"
            placeholder={loading ? "Loading invoices…" : "Search by invoice number"}
            searchable
            data={options}
            value={invoiceId}
            onChange={setInvoiceId}
            nothingFoundMessage="No open invoices for this patient"
            disabled={loading}
            required
          />
        )}
      </Stack>
    </Modal>
  );
}
