import { zodResolver } from "@hookform/resolvers/zod";
import { Group, Stack } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { DoctorPayout } from "@medbrains/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Alert, Button, Input, Modal, SegmentedControl } from "@/components/ui";
import { doctorPayoutsService } from "@/services/doctor-payouts.service";
import { errorText } from "./shared";

export const outcomeSchema = z
  .object({
    outcome: z.enum(["paid", "failed"]),
    utr: z.string().trim(),
    reason: z.string().trim(),
  })
  .refine((v) => v.outcome !== "paid" || v.utr.length >= 6, {
    path: ["utr"],
    message: "The bank's UTR",
  })
  .refine((v) => v.outcome !== "failed" || v.reason.length >= 3, {
    path: ["reason"],
    message: "Why it failed",
  });

type Outcome = z.infer<typeof outcomeSchema>;

/** Record what the bank (or RazorpayX) did with a payout. */
export function PayoutActions({ payout }: { payout: DoctorPayout }) {
  const [opened, modal] = useDisclosure(false);
  const queryClient = useQueryClient();
  const { control, handleSubmit, watch } = useForm<Outcome>({
    resolver: zodResolver(outcomeSchema),
    defaultValues: { outcome: "paid", utr: "", reason: "" },
  });
  const record = useMutation({
    mutationFn: (v: Outcome) =>
      v.outcome === "paid"
        ? doctorPayoutsService.markDoctorPayoutPaid(payout.id, v.utr)
        : doctorPayoutsService.markDoctorPayoutFailed(payout.id, v.reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["doctor-payouts"] });
      modal.close();
    },
  });
  if (payout.status !== "pending" && payout.status !== "processing") return null;
  const outcome = watch("outcome");
  return (
    <>
      <Button size="xs" tone="secondary" onClick={modal.open}>
        Record result
      </Button>
      <Modal opened={opened} onClose={modal.close} title="What happened to this payout?">
        <Stack gap="sm" component="form" onSubmit={handleSubmit((v) => record.mutate(v))}>
          <Controller
            control={control}
            name="outcome"
            render={({ field }) => (
              <SegmentedControl
                value={field.value}
                onChange={field.onChange}
                data={[
                  { value: "paid", label: "Paid" },
                  { value: "failed", label: "Failed" },
                ]}
              />
            )}
          />
          <Controller
            control={control}
            name={outcome === "paid" ? "utr" : "reason"}
            render={({ field, fieldState }) => (
              <Input
                label={outcome === "paid" ? "UTR" : "Reason"}
                {...field}
                error={fieldState.error?.message}
              />
            )}
          />
          {record.isError && <Alert tone="danger">{errorText(record.error)}</Alert>}
          <Group justify="flex-end">
            <Button type="submit" loading={record.isPending}>
              Save
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
