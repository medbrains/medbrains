import { zodResolver } from "@hookform/resolvers/zod";
import { Group, Stack } from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useAuthStore } from "@medbrains/stores";
import type { SetupUser, StartBedsideTransfusionRequest } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Alert, Checkbox, Input, Modal, NumberField, Select, toast } from "@/components/ui";
import { adminAccessService } from "@/services/adminAccess.service";
import { ipdService } from "@/services/ipd.service";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const PRODUCT_TYPES = [
  { value: "prbc", label: "PRBC" },
  { value: "whole_blood", label: "Whole Blood" },
  { value: "ffp", label: "FFP" },
  { value: "platelets", label: "Platelets" },
  { value: "cryo", label: "Cryoprecipitate" },
];

const schema = z.object({
  // Right patient (IPSG-1): read off the arm, compared on the server with
  // the patient the unit was issued for.
  wristband_uhid: z.string().trim().min(1, "Scan the patient's wristband"),
  product_type: z.string().min(1, "Choose the product"),
  bag_number: z.string().trim().min(1, "Scan or type the bag number"),
  blood_group: z.string().min(1, "Choose the unit's group"),
  volume_ml: z.number().int().positive().optional(),
  expiry_date: z.string().min(1, "Enter the expiry on the bag"),
  product_verified_by_id: z.string().min(1, "A second nurse must check the bag"),
  // The server refuses either as false; the form says so before the request.
  crossmatch_compatible: z.literal(true, { message: "Return an incompatible unit to the bank" }),
  consent_on_file: z.literal(true, { message: "Consent must be on file first" }),
});
type StartForm = z.infer<typeof schema>;

interface Props {
  admissionId: string;
  opened: boolean;
  onClose: () => void;
}

/** Hang a unit: the bag, its expiry, the second-nurse check and the consent. */
export function StartTransfusionModal({ admissionId, opened, onClose }: Props) {
  const qc = useQueryClient();
  const currentUserId = useAuthStore((s) => s.user?.id);
  const { data: users = [], isError: usersFailed } = useQuery({
    queryKey: ["setup-users"],
    queryFn: () => adminAccessService.listUsers(),
    staleTime: 300_000,
    enabled: opened,
  });
  const checkers = (users as SetupUser[])
    .filter((u) => u.id !== currentUserId)
    .map((u) => ({ value: u.id, label: u.full_name }));

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<StartForm>({ resolver: zodResolver(schema) });

  const startMut = useMutation({
    mutationFn: (values: StartForm) =>
      ipdService.startBedsideTransfusion(
        admissionId,
        values satisfies StartBedsideTransfusionRequest,
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["bedside-transfusions", admissionId] });
      toast.success("Transfusion started — record the baseline observation now");
      reset();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message, { title: "Transfusion not started" }),
  });

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Start transfusion"
      primaryAction={{
        label: "Start transfusion",
        onClick: () => void handleSubmit((v) => startMut.mutate(v))(),
        loading: startMut.isPending,
      }}
      secondaryAction={{ label: "Cancel", onClick: onClose }}
    >
      <Stack gap="sm">
        <Controller
          name="wristband_uhid"
          control={control}
          render={({ field }) => (
            <Input
              label="Patient wristband"
              description="Scan the wristband barcode, or type the UHID printed on it — not from the screen."
              required
              data-autofocus
              autoComplete="off"
              value={field.value ?? ""}
              onChange={(e) => field.onChange(e.currentTarget.value)}
              error={errors.wristband_uhid?.message}
            />
          )}
        />
        <Group grow>
          <Controller
            name="product_type"
            control={control}
            render={({ field }) => (
              <Select
                label="Product"
                required
                data={PRODUCT_TYPES}
                value={field.value ?? null}
                onChange={(v) => field.onChange(v ?? "")}
                error={errors.product_type?.message}
              />
            )}
          />
          <Controller
            name="blood_group"
            control={control}
            render={({ field }) => (
              <Select
                label="Unit blood group"
                required
                data={BLOOD_GROUPS}
                value={field.value ?? null}
                onChange={(v) => field.onChange(v ?? "")}
                error={errors.blood_group?.message}
              />
            )}
          />
        </Group>
        <Controller
          name="bag_number"
          control={control}
          render={({ field }) => (
            <Input
              label="Bag number"
              required
              value={field.value ?? ""}
              onChange={(e) => field.onChange(e.currentTarget.value)}
              error={errors.bag_number?.message}
            />
          )}
        />
        <Group grow>
          <Controller
            name="volume_ml"
            control={control}
            render={({ field }) => (
              <NumberField
                label="Volume (ml)"
                value={field.value ?? ""}
                onChange={(v) => field.onChange(v === "" ? undefined : Number(v))}
                min={1}
                error={errors.volume_ml?.message}
              />
            )}
          />
          <Controller
            name="expiry_date"
            control={control}
            render={({ field }) => (
              <DateInput
                label="Expiry on bag"
                required
                valueFormat="YYYY-MM-DD"
                value={field.value ?? null}
                onChange={(v) => field.onChange(v ?? "")}
                error={errors.expiry_date?.message}
              />
            )}
          />
        </Group>
        {usersFailed && (
          <Alert tone="danger" title="Staff list could not be loaded">
            The second checker cannot be chosen until it loads. Do not hang the unit unchecked.
          </Alert>
        )}
        <Controller
          name="product_verified_by_id"
          control={control}
          render={({ field }) => (
            <Select
              label="Second nurse who checked the bag against the patient"
              required
              searchable
              data={checkers}
              value={field.value ?? null}
              onChange={(v) => field.onChange(v ?? "")}
              error={errors.product_verified_by_id?.message}
            />
          )}
        />
        <Controller
          name="crossmatch_compatible"
          control={control}
          render={({ field }) => (
            <Checkbox
              label="Compatibility label matches this patient"
              checked={field.value === true}
              onChange={(e) => field.onChange(e.currentTarget.checked)}
              error={errors.crossmatch_compatible?.message}
            />
          )}
        />
        <Controller
          name="consent_on_file"
          control={control}
          render={({ field }) => (
            <Checkbox
              label="Transfusion consent is on file"
              checked={field.value === true}
              onChange={(e) => field.onChange(e.currentTarget.checked)}
              error={errors.consent_on_file?.message}
            />
          )}
        />
      </Stack>
    </Modal>
  );
}
