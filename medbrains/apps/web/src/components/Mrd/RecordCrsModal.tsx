// Record the registration number CRS issued for a birth or death, which
// closes it as reported.

import { zodResolver } from "@hookform/resolvers/zod";
import { Group, Stack, Text } from "@mantine/core";
import type { CrsEvent } from "@medbrains/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button, Input, Modal, toast } from "@/components/ui";
import { mrdService } from "@/services/mrd.service";

const today = () => new Date().toLocaleDateString("en-CA");

function registrationSchema(eventDate: string) {
  return z.object({
    crs_registration_number: z
      .string()
      .trim()
      .min(1, "Give the registration number CRS issued")
      .max(60),
    registered_on: z
      .string()
      .min(1, "Give the date of registration")
      .refine((d) => d >= eventDate, "Registration cannot precede the event")
      .refine((d) => d <= today(), "Registration cannot be in the future"),
  });
}
type RegistrationForm = z.infer<ReturnType<typeof registrationSchema>>;

interface RecordCrsModalProps {
  event: CrsEvent;
  onClose: () => void;
}

export function RecordCrsModal({ event, onClose }: RecordCrsModalProps) {
  const qc = useQueryClient();
  const { register, handleSubmit, formState } = useForm<RegistrationForm>({
    resolver: zodResolver(registrationSchema(event.event_date)),
    defaultValues: { crs_registration_number: "", registered_on: today() },
  });
  const save = useMutation({
    mutationFn: (f: RegistrationForm) => mrdService.recordCrsRegistration(event.id, f),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["mrd-crs"] });
      toast.success("Registration recorded");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message, { title: "Not recorded" }),
  });
  const errors = formState.errors;

  return (
    <Modal opened onClose={onClose} title="Record CRS registration" size="md">
      <Stack gap="sm">
        <Text size="sm" c="dimmed">
          {event.event_type === "birth" ? "Birth" : "Death"} of {event.event_date} ·{" "}
          {event.patient_name ?? ""}
        </Text>
        <Input
          label="CRS registration number"
          required
          error={errors.crs_registration_number?.message}
          {...register("crs_registration_number")}
        />
        <Input
          type="date"
          label="Registered on"
          required
          max={today()}
          error={errors.registered_on?.message}
          {...register("registered_on")}
        />
        <Group justify="flex-end">
          <Button tone="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            tone="primary"
            loading={save.isPending}
            onClick={() => void handleSubmit((f) => save.mutate(f))()}
          >
            Save
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
