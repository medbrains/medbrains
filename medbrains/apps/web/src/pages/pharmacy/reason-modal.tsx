/**
 * The one form the back of the fulfilment flow keeps asking: why did this order
 * stop short of a handover? A release (nobody came) and a cancel (pulled
 * mid-flight) both put stock back on the shelf and leave a paid bill with
 * nothing against it — the reason is the only thing that answers the questions
 * somebody will ask later.
 */

import { zodResolver } from "@hookform/resolvers/zod";
import { Group, Stack, Text } from "@mantine/core";
import { type FulfilmentReasonFormInput, fulfilmentReasonFormSchema } from "@medbrains/schemas";
import { useForm } from "react-hook-form";
import { Button, Modal, TextArea } from "@/components/ui";

export interface ReasonModalProps {
  opened: boolean;
  title: string;
  description: string;
  label: string;
  placeholder: string;
  confirmLabel: string;
  confirmTone?: "primary" | "secondary" | "danger";
  pending?: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

export function ReasonModal({
  opened,
  title,
  description,
  label,
  placeholder,
  confirmLabel,
  confirmTone = "primary",
  pending = false,
  onClose,
  onConfirm,
}: ReasonModalProps) {
  const { register, handleSubmit, reset, formState } = useForm<FulfilmentReasonFormInput>({
    resolver: zodResolver(fulfilmentReasonFormSchema),
    defaultValues: { reason: "" },
  });

  function close() {
    reset();
    onClose();
  }

  function submit(values: FulfilmentReasonFormInput) {
    onConfirm(values.reason.trim());
    reset();
  }

  return (
    <Modal opened={opened} onClose={close} title={title}>
      <form onSubmit={handleSubmit(submit)}>
        <Stack>
          <Text size="sm" c="dimmed">
            {description}
          </Text>
          <TextArea
            label={label}
            placeholder={placeholder}
            minRows={2}
            error={formState.errors.reason?.message}
            {...register("reason")}
          />
          <Group justify="flex-end">
            <Button tone="ghost" onClick={close}>
              Keep the order
            </Button>
            <Button type="submit" tone={confirmTone} disabled={pending}>
              {confirmLabel}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
