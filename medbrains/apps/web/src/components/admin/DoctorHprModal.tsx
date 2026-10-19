/**
 * Record a doctor's HPR ID (ABDM Healthcare Professionals Registry) and verify
 * it against the registry. Saving never marks it verified; changing the ID
 * clears a previous verification.
 */

import { zodResolver } from "@hookform/resolvers/zod";
import { Group, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { DoctorHpr } from "@medbrains/types";
import { IconShieldCheck } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Alert, Badge, Button, Input, Modal } from "@/components/ui";
import { abdmRegistryService } from "@/services/abdmRegistry.service";

export const HPR_COVERAGE_KEY = ["abdm-hpr-coverage"];

const hprSchema = z.object({
  hpr_id: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d{14}$/.test(v.replace(/[-\s]/g, "")), "HPR ID is 14 digits"),
});
type HprForm = z.infer<typeof hprSchema>;

export interface DoctorHprTarget {
  id: string;
  display_name: string;
  hpr_id: string | null;
  hpr_verified_at: string | null;
}

interface DoctorHprModalProps {
  doctor: DoctorHprTarget;
  registryConfigured: boolean;
  onClose: () => void;
}

export function DoctorHprModal({ doctor, registryConfigured, onClose }: DoctorHprModalProps) {
  const queryClient = useQueryClient();
  const { handleSubmit, register, formState } = useForm<HprForm>({
    resolver: zodResolver(hprSchema),
    defaultValues: { hpr_id: doctor.hpr_id ?? "" },
  });
  const done = (row: DoctorHpr, title: string) => {
    notifications.show({ title, message: row.display_name, color: "success" });
    void queryClient.invalidateQueries({ queryKey: ["admin-doctors"] });
    void queryClient.invalidateQueries({ queryKey: HPR_COVERAGE_KEY });
    onClose();
  };
  const fail = (err: Error) =>
    notifications.show({ title: "HPR update failed", message: err.message, color: "danger" });
  const save = useMutation({
    mutationFn: (form: HprForm) =>
      abdmRegistryService.setDoctorHprId(doctor.id, { hpr_id: form.hpr_id || null }),
    onSuccess: (row) => done(row, "HPR ID saved"),
    onError: fail,
  });
  const verify = useMutation({
    mutationFn: () => abdmRegistryService.verifyDoctorHprId(doctor.id),
    onSuccess: (row) => done(row, "HPR ID verified"),
    onError: fail,
  });

  return (
    <Modal opened onClose={onClose} title={`HPR ID — ${doctor.display_name}`}>
      <Stack gap="sm">
        <Input
          label="HPR ID"
          description="14 digits, as issued by hpr.abdm.gov.in. Leave empty to clear."
          placeholder="21-1521-3828-3227"
          error={formState.errors.hpr_id?.message}
          {...register("hpr_id")}
        />
        {doctor.hpr_verified_at ? (
          <Badge tone="success" leftSection={<IconShieldCheck size={16} />}>
            Verified {new Date(doctor.hpr_verified_at).toLocaleDateString()}
          </Badge>
        ) : (
          doctor.hpr_id && (
            <Text size="sm" c="dimmed">
              Not yet verified with HPR.
            </Text>
          )
        )}
        {!registryConfigured && (
          <Alert tone="info">
            ABDM keys are not configured yet, so HPR IDs can be recorded but not verified.
          </Alert>
        )}
        <Group justify="flex-end">
          <Button
            tone="secondary"
            disabled={!registryConfigured || !doctor.hpr_id}
            loading={verify.isPending}
            onClick={() => verify.mutate()}
          >
            Verify with HPR
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
