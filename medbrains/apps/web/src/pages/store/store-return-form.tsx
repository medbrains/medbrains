import { zodResolver } from "@hookform/resolvers/zod";
import { Stack, Text } from "@mantine/core";
import type { StoreOrder } from "@medbrains/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { Button, Modal, NumberField, Select, TextArea, toast } from "@/components/ui";
import { portalService } from "@/services/portal.service";
import { RETURN_REASONS } from "./storefront-p2";

const schema = z.object({
  reason: z.enum(["wrong_item", "damaged", "short_dated", "excess"]),
  note: z.string(),
  lines: z.array(z.object({ catalog_item_id: z.string(), quantity: z.number().int().min(0) })),
});
type Form = z.infer<typeof schema>;

interface StoreReturnFormProps {
  token: string;
  order: StoreOrder | null;
  onClose: () => void;
}

/**
 * Ask to return medicines from a delivered order: a wrong, damaged,
 * short-dated or excess medicine, within the return window. The pharmacy
 * acknowledges within 48 hours; what may go back on the shelf is decided by
 * the law, and the refund goes back the way it was paid.
 */
export function StoreReturnForm({ token, order, onClose }: StoreReturnFormProps) {
  return (
    <Modal opened={order !== null} onClose={onClose} title="Return medicines">
      {order && <ReturnBody key={order.id} token={token} order={order} onDone={onClose} />}
    </Modal>
  );
}

function ReturnBody({
  token,
  order,
  onDone,
}: {
  token: string;
  order: StoreOrder;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const sent = order.lines.filter((l) => l.status === "approved");
  const { control, handleSubmit } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      reason: "damaged",
      note: "",
      lines: sent.map((l) => ({ catalog_item_id: l.catalog_item_id, quantity: 0 })),
    },
  });
  const { fields } = useFieldArray({ control, name: "lines" });
  const ask = useMutation({
    mutationFn: (v: Form) => {
      const lines = v.lines.filter((l) => l.quantity > 0);
      if (lines.length === 0) throw new Error("Choose how many of each are coming back");
      return portalService.requestStoreReturn(token, order.id, {
        lines,
        reason: v.reason,
        ...(v.note.trim() ? { note: v.note.trim() } : {}),
      });
    },
    onSuccess: (ticket) => {
      toast.success(
        `Your complaint number is ${ticket.complaint_code ?? ticket.id}. We reply within 48 hours.`,
        { title: "Return requested" },
      );
      void queryClient.invalidateQueries({ queryKey: ["store-orders"] });
      onDone();
    },
    onError: (e: Error) => toast.error(e.message, { title: "Not requested" }),
  });
  return (
    <Stack component="form" gap="sm" onSubmit={handleSubmit((v) => ask.mutate(v))}>
      {fields.map((f, i) => {
        const line = sent[i];
        return (
          <Controller
            key={f.id}
            control={control}
            name={`lines.${i}.quantity`}
            render={({ field }) => (
              <NumberField
                label={line?.drug_name ?? "Medicine"}
                description={`Up to ${line?.approved_quantity ?? line?.quantity ?? 0}`}
                min={0}
                max={line?.approved_quantity ?? line?.quantity ?? 0}
                value={field.value}
                onChange={(v) => field.onChange(Number(v) || 0)}
              />
            )}
          />
        );
      })}
      <Controller
        control={control}
        name="reason"
        render={({ field }) => (
          <Select
            label="What is wrong"
            data={RETURN_REASONS}
            value={field.value}
            onChange={(v) => field.onChange(v ?? "damaged")}
          />
        )}
      />
      <Controller
        control={control}
        name="note"
        render={({ field }) => <TextArea label="Anything else" {...field} />}
      />
      <Text size="xs" c="dimmed">
        A medicine goes back on the shelf only if its pack is sealed and in date and it was never
        refrigerated or controlled; otherwise it is destroyed safely. Either way you are refunded.
      </Text>
      <Button type="submit" tone="primary" loading={ask.isPending}>
        Ask to return
      </Button>
    </Stack>
  );
}
