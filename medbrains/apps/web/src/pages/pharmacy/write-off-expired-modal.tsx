import { zodResolver } from "@hookform/resolvers/zod";
import { Group, Stack, Text } from "@mantine/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Alert, Button, Input, Modal, Select, TextArea, toast } from "@/components/ui";
import { pharmacyService } from "@/services/pharmacy.service";

interface Props {
  opened: boolean;
  onClose: () => void;
  /** Batches the write-off will destroy (controlled drugs excluded). */
  batchCount: number;
}

const METHODS = [
  { value: "incineration", label: "Incineration" },
  { value: "chemical", label: "Chemical" },
  { value: "landfill", label: "Landfill" },
  { value: "return_to_manufacturer", label: "Return to manufacturer" },
  { value: "other", label: "Other" },
];

const schema = z.object({
  method: z.string().min(1, "Choose how the stock is destroyed"),
  witness_name: z.string().trim().min(2, "Name the witness to the destruction"),
  notes: z.string().trim().max(500),
});
type WriteOffInput = z.infer<typeof schema>;

/** Destroys every expired, non-controlled batch under one witnessed certificate. */
export function WriteOffExpiredModal({ opened, onClose, batchCount }: Props) {
  const queryClient = useQueryClient();
  const form = useForm<WriteOffInput>({
    resolver: zodResolver(schema),
    defaultValues: { method: "incineration", witness_name: "", notes: "" },
  });
  const writeOff = useMutation({
    mutationFn: (values: WriteOffInput) =>
      pharmacyService.writeOffExpired({
        method: values.method,
        witness_name: values.witness_name,
        ...(values.notes ? { notes: values.notes } : {}),
      }),
    onSuccess: (result) => {
      toast.success(
        result.controlled_held > 0
          ? `${result.controlled_held} controlled batch(es) still to destroy through the NDPS register.`
          : "The destruction is on record.",
        { title: `Written off — certificate ${result.certificate_number}` },
      );
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-expired"] });
      form.reset();
      onClose();
    },
  });

  return (
    <Modal opened={opened} onClose={onClose} title="Write off expired stock">
      <form onSubmit={form.handleSubmit((values) => writeOff.mutate(values))}>
        <Stack>
          <Text size="sm">
            {batchCount} expired batch(es) will be set to zero and recorded on one destruction
            certificate. Controlled drugs are not included.
          </Text>
          <Controller
            control={form.control}
            name="method"
            render={({ field, fieldState }) => (
              <Select
                label="Method"
                data={METHODS}
                value={field.value}
                onChange={(v) => field.onChange(v ?? "")}
                error={fieldState.error?.message}
                required
              />
            )}
          />
          <Controller
            control={form.control}
            name="witness_name"
            render={({ field, fieldState }) => (
              <Input
                {...field}
                label="Witness"
                description="Who saw the stock destroyed"
                error={fieldState.error?.message}
                required
                data-testid="write-off-witness"
              />
            )}
          />
          <Controller
            control={form.control}
            name="notes"
            render={({ field, fieldState }) => (
              <TextArea {...field} label="Notes" error={fieldState.error?.message} />
            )}
          />
          {writeOff.isError && (
            <Alert tone="danger" title="Not written off">
              {writeOff.error.message}
            </Alert>
          )}
          <Group justify="flex-end">
            <Button tone="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              tone="danger"
              type="submit"
              loading={writeOff.isPending}
              data-testid="write-off-confirm"
            >
              Write off {batchCount} batch(es)
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
