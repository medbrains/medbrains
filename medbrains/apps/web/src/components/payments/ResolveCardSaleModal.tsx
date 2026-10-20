import { zodResolver } from "@hookform/resolvers/zod";
import { Stack, Text } from "@mantine/core";
import type { PosSaleView, ResolveSale } from "@medbrains/types";
import { useMutation } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Alert, Input, Modal, SegmentedControl, TextArea } from "@/components/ui";
import { paymentsService } from "@/services/payments.service";

interface ResolveCardSaleModalProps {
  sale: PosSaleView;
  opened: boolean;
  onClose: () => void;
  /** The sale as the server now holds it. */
  onResolved: (sale: PosSaleView) => void;
}

/** Same ceilings as the server: an RRN is 12 digits, codes are shorter. */
const MAX_REFERENCE = 64;
const MAX_REASON = 500;

const schema = z
  .object({
    outcome: z.enum(["paid", "not_paid"]),
    rrn: z.string().trim().max(MAX_REFERENCE),
    approval_code: z.string().trim().max(MAX_REFERENCE),
    method: z.enum(["card", "upi"]),
    reason: z.string().trim().max(MAX_REASON),
  })
  .superRefine((v, ctx) => {
    if (v.outcome === "paid" && !v.rrn && !v.approval_code) {
      ctx.addIssue({
        code: "custom",
        path: ["rrn"],
        message: "Type the RRN or the approval code printed on the slip",
      });
    }
    if (v.outcome === "not_paid" && !v.reason) {
      ctx.addIssue({
        code: "custom",
        path: ["reason"],
        message: "Say what the slip or the machine's report shows",
      });
    }
  });
type Form = z.infer<typeof schema>;

const OUTCOMES = [
  { value: "paid", label: "Slip shows approved" },
  { value: "not_paid", label: "No money was taken" },
];
const METHODS = [
  { value: "card", label: "Card" },
  { value: "upi", label: "UPI" },
];

function toRequest(v: Form): ResolveSale {
  return v.outcome === "paid"
    ? {
        outcome: "paid",
        rrn: v.rrn || undefined,
        approval_code: v.approval_code || undefined,
        method: v.method,
      }
    : { outcome: "not_paid", reason: v.reason };
}

/**
 * A supervisor settles a card sale with no definite outcome from the
 * machine's slip: approved (with its RRN or approval code — it then posts
 * once) or not paid (with what the slip shows). Audited on the server.
 */
export function ResolveCardSaleModal({
  sale,
  opened,
  onClose,
  onResolved,
}: ResolveCardSaleModalProps) {
  const { control, handleSubmit, watch } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { outcome: "paid", rrn: "", approval_code: "", method: "card", reason: "" },
  });
  const resolve = useMutation({
    mutationFn: (v: Form) => paymentsService.resolveCardSale(sale.transaction_id, toRequest(v)),
    onSuccess: (done) => {
      onResolved(done);
      onClose();
    },
  });
  const paid = watch("outcome") === "paid";
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Resolve from the machine's slip"
      primaryAction={{
        label: paid ? "Record as paid" : "Record as not paid",
        onClick: () => void handleSubmit((v) => resolve.mutate(v))(),
        loading: resolve.isPending,
      }}
      secondaryAction={{ label: "Cancel", onClick: onClose }}
    >
      <Stack gap="sm">
        <Text size="sm">
          {sale.terminal_label} · ₹{Number(sale.amount).toFixed(2)}. Find this payment on the
          machine's last slips or its transaction report.
        </Text>
        <Controller
          control={control}
          name="outcome"
          render={({ field }) => (
            <SegmentedControl
              aria-label="What the slip shows"
              data={OUTCOMES}
              value={field.value}
              onChange={field.onChange}
              fullWidth
            />
          )}
        />
        {paid ? (
          <>
            <Controller
              control={control}
              name="rrn"
              render={({ field, fieldState }) => (
                <Input
                  label="RRN"
                  description="The 12-digit retrieval reference number on the slip"
                  error={fieldState.error?.message}
                  {...field}
                />
              )}
            />
            <Controller
              control={control}
              name="approval_code"
              render={({ field, fieldState }) => (
                <Input label="Approval code" error={fieldState.error?.message} {...field} />
              )}
            />
            <Controller
              control={control}
              name="method"
              render={({ field }) => (
                <SegmentedControl
                  aria-label="Paid by"
                  data={METHODS}
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          </>
        ) : (
          <Controller
            control={control}
            name="reason"
            render={({ field, fieldState }) => (
              <TextArea
                label="What the slip shows"
                placeholder="Slip shows TXN CANCELLED at 10:42"
                error={fieldState.error?.message}
                {...field}
              />
            )}
          />
        )}
        {resolve.isError && (
          <Alert tone="danger" title="Not recorded">
            {resolve.error.message}
          </Alert>
        )}
      </Stack>
    </Modal>
  );
}
