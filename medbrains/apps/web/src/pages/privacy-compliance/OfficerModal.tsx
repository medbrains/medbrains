// Name or change a privacy officer. A change is unpublished until someone
// publishes it again, so patients never see details nobody confirmed.

import { zodResolver } from "@hookform/resolvers/zod";
import { Text } from "@mantine/core";
import type { PrivacyOfficer, PrivacyOfficerRole } from "@medbrains/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { FormModal } from "@/components";
import { Input, toast } from "@/components/ui";
import { OFFICER_BASIS, OFFICER_LABEL } from "@/lib/privacy-compliance";
import { privacyComplianceService } from "@/services/privacyCompliance.service";

const schema = z.object({
  name: z.string().trim().min(2, "Give the person's name"),
  designation: z.string().trim().min(2, "Give their designation"),
  email: z.string().trim().email("Give a working email address"),
  phone: z
    .string()
    .trim()
    .refine((v) => (v.match(/\d/g) ?? []).length >= 6, "Give a phone number patients can call"),
  address: z.string(),
  hours: z.string(),
});

type FormValues = z.infer<typeof schema>;

export function OfficerModal({
  role,
  current,
  onClose,
}: {
  role: PrivacyOfficerRole;
  current: PrivacyOfficer | undefined;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: current?.name ?? "",
      designation: current?.designation ?? "",
      email: current?.email ?? "",
      phone: current?.phone ?? "",
      address: current?.address ?? "",
      hours: current?.hours ?? "",
    },
  });
  const save = useMutation({
    mutationFn: (v: FormValues) => privacyComplianceService.setOfficer(role, v),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["privacy-compliance"] });
      toast.success(`${OFFICER_LABEL[role]} saved — publish it so patients can see it`);
      onClose();
    },
  });
  const field = (name: keyof FormValues, label: string, required = true) => (
    <Controller
      control={form.control}
      name={name}
      render={({ field: f, fieldState }) => (
        <Input label={label} required={required} {...f} error={fieldState.error?.message} />
      )}
    />
  );
  return (
    <FormModal
      opened
      onClose={onClose}
      title={OFFICER_LABEL[role]}
      onSubmit={form.handleSubmit((v) => save.mutate(v))}
      submitLabel="Save"
      submitting={save.isPending}
      error={save.error?.message ?? null}
    >
      <Text size="sm" c="dimmed">
        {OFFICER_BASIS[role]}
      </Text>
      {field("name", "Name")}
      {field("designation", "Designation")}
      {field("email", "Email")}
      {field("phone", "Phone")}
      {field("address", "Postal address", false)}
      {field("hours", "Hours they can be reached", false)}
    </FormModal>
  );
}
