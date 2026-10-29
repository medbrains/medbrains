// Record that a line list was entered on IHIP: the portal's acknowledgement,
// against every case on the list.

import { zodResolver } from "@hookform/resolvers/zod";
import { Group, Stack, Text } from "@mantine/core";
import type { IhipLineList } from "@medbrains/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button, Input, Modal, toast } from "@/components/ui";
import { ckbService } from "@/services/ckb.service";

const ackSchema = z.object({
  acknowledgement: z.string().trim().min(1, "Give the acknowledgement IHIP showed").max(80),
});
type AckForm = z.infer<typeof ackSchema>;

interface IhipSubmitModalProps {
  list: IhipLineList;
  onClose: () => void;
  onSubmitted: () => void;
}

export function IhipSubmitModal({ list, onClose, onSubmitted }: IhipSubmitModalProps) {
  const qc = useQueryClient();
  const { register, handleSubmit, formState } = useForm<AckForm>({
    resolver: zodResolver(ackSchema),
    defaultValues: { acknowledgement: "" },
  });
  const submit = useMutation({
    mutationFn: (f: AckForm) =>
      ckbService.submitIhipLineList({
        form: list.form,
        report_ids: list.report_ids,
        acknowledgement: f.acknowledgement,
      }),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ["ckb-notifiable-reports"] });
      toast.success(`${r.submitted} cases recorded as reported to IHIP`);
      onSubmitted();
    },
    onError: (e: Error) => toast.error(e.message, { title: "Not recorded" }),
  });

  return (
    <Modal opened onClose={onClose} title="Record IHIP acknowledgement" size="md">
      <Stack gap="sm">
        <Text size="sm" c="dimmed">
          {list.rows.length} {list.form}-form case{list.rows.length === 1 ? "" : "s"},{" "}
          {list.period_from} to {list.period_to}. Record this only once they are entered on IHIP.
        </Text>
        <Input
          label="IHIP acknowledgement"
          placeholder="e.g. IHIP/TN/2026/004812"
          required
          error={formState.errors.acknowledgement?.message}
          {...register("acknowledgement")}
        />
        <Group justify="flex-end">
          <Button tone="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            tone="primary"
            loading={submit.isPending}
            onClick={() => void handleSubmit((f) => submit.mutate(f))()}
          >
            Mark submitted
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
