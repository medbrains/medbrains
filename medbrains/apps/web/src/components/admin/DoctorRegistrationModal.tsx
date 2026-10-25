/**
 * Complete a doctor's registration: qualification, NMC/MCI and state council
 * numbers, council name, validity and specialty. Doctor profiles are created
 * automatically for every doctor account, with these left for the admin.
 */

import { zodResolver } from "@hookform/resolvers/zod";
import { Group, SimpleGrid, Stack } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { DoctorProfile } from "@medbrains/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button, Input, Modal } from "@/components/ui";
import { adminDoctorsService } from "@/services/adminDoctors.service";

const registrationSchema = z.object({
  qualification_string: z.string().trim().max(200),
  mci_number: z.string().trim().max(50),
  state_council_number: z.string().trim().max(50),
  state_council_name: z.string().trim().max(100),
  registration_valid_until: z.string(),
  subspecialty: z.string().trim().max(100),
});
type RegistrationForm = z.infer<typeof registrationSchema>;

interface DoctorRegistrationModalProps {
  doctor: DoctorProfile;
  onClose: () => void;
}

/** Empty means "leave as it is": the server keeps the stored value for null. */
const orNull = (value: string) => value.trim() || null;

export function DoctorRegistrationModal({ doctor, onClose }: DoctorRegistrationModalProps) {
  const queryClient = useQueryClient();
  const { handleSubmit, register, formState } = useForm<RegistrationForm>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      qualification_string: doctor.qualification_string ?? "",
      mci_number: doctor.mci_number ?? "",
      state_council_number: doctor.state_council_number ?? "",
      state_council_name: doctor.state_council_name ?? "",
      registration_valid_until: doctor.registration_valid_until ?? "",
      subspecialty: doctor.subspecialty ?? "",
    },
  });
  const save = useMutation({
    mutationFn: (form: RegistrationForm) =>
      adminDoctorsService.updateDoctor(doctor.id, {
        qualification_string: orNull(form.qualification_string),
        mci_number: orNull(form.mci_number),
        state_council_number: orNull(form.state_council_number),
        state_council_name: orNull(form.state_council_name),
        registration_valid_until: orNull(form.registration_valid_until),
        subspecialty: orNull(form.subspecialty),
      }),
    onSuccess: (row) => {
      notifications.show({
        title: "Registration saved",
        message: row.display_name,
        color: "success",
      });
      void queryClient.invalidateQueries({ queryKey: ["admin-doctors"] });
      onClose();
    },
    onError: (err: Error) =>
      notifications.show({ title: "Save failed", message: err.message, color: "danger" }),
  });
  const errors = formState.errors;

  return (
    <Modal opened onClose={onClose} title={`Registration — ${doctor.display_name}`} size="lg">
      <Stack gap="sm">
        <Input
          label="Qualification"
          placeholder="MBBS, MD General Medicine"
          error={errors.qualification_string?.message}
          {...register("qualification_string")}
        />
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <Input
            label="NMC / MCI number"
            error={errors.mci_number?.message}
            {...register("mci_number")}
          />
          <Input
            label="State council number"
            error={errors.state_council_number?.message}
            {...register("state_council_number")}
          />
          <Input
            label="State council name"
            placeholder="Tamil Nadu Medical Council"
            error={errors.state_council_name?.message}
            {...register("state_council_name")}
          />
          <Input
            label="Registration valid until"
            type="date"
            error={errors.registration_valid_until?.message}
            {...register("registration_valid_until")}
          />
          <Input
            label="Specialty / unit"
            error={errors.subspecialty?.message}
            {...register("subspecialty")}
          />
        </SimpleGrid>
        <Group justify="flex-end">
          <Button tone="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            tone="primary"
            loading={save.isPending}
            onClick={() => void handleSubmit((form) => save.mutate(form))()}
          >
            Save registration
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
