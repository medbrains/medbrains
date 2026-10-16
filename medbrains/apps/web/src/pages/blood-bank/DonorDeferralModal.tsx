import { zodResolver } from "@hookform/resolvers/zod";
import { Stack } from "@mantine/core";
import { DateInput } from "@mantine/dates";
import type { BloodDonor, SetDonorDeferralRequest } from "@medbrains/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Alert, Modal, SegmentedControl, TextArea, toast } from "@/components/ui";
import { bloodBankService } from "@/services/bloodBank.service";

const schema = z
  .object({
    kind: z.enum(["temporary", "permanent"]),
    until: z.string().optional(),
    reason: z.string().trim().min(1, "Give the reason"),
  })
  .refine((v) => v.kind === "permanent" || Boolean(v.until), {
    message: "A temporary deferral needs an end date",
    path: ["until"],
  });
type DeferForm = z.infer<typeof schema>;

const reinstateSchema = z.object({ reason: z.string().trim().min(1, "Give the reason") });
type ReinstateForm = z.infer<typeof reinstateSchema>;

interface Props {
  donor: BloodDonor;
  opened: boolean;
  onClose: () => void;
  onSaved: (donor: BloodDonor) => void;
}

function useSetDeferral(donor: BloodDonor, onSaved: Props["onSaved"]) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: SetDonorDeferralRequest) =>
      bloodBankService.setDonorDeferral(donor.id, data),
    onSuccess: (saved) => {
      void qc.invalidateQueries({ queryKey: ["blood-bank", "donors"] });
      toast.success(saved.is_deferred ? "Donor deferred" : "Donor reinstated");
      onSaved(saved);
    },
    onError: (e: Error) => toast.error(e.message, { title: "Deferral not changed" }),
  });
}

/** Defer a donor (with an end date, or permanently), or reinstate one. */
export function DonorDeferralModal({ donor, opened, onClose, onSaved }: Props) {
  return donor.is_deferred ? (
    <ReinstateModal donor={donor} opened={opened} onClose={onClose} onSaved={onSaved} />
  ) : (
    <DeferModal donor={donor} opened={opened} onClose={onClose} onSaved={onSaved} />
  );
}

function DeferModal({ donor, opened, onClose, onSaved }: Props) {
  const mut = useSetDeferral(donor, onSaved);
  const { control, handleSubmit, watch, formState } = useForm<DeferForm>({
    resolver: zodResolver(schema),
    defaultValues: { kind: "temporary", reason: "" },
  });
  const kind = watch("kind");
  const submit = handleSubmit((v) =>
    mut.mutate({
      deferred: true,
      until: v.kind === "temporary" ? v.until : undefined,
      reason: v.reason.trim(),
    }),
  );
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={`Defer ${donor.first_name} ${donor.last_name}`}
      primaryAction={{ label: "Defer donor", onClick: () => void submit(), loading: mut.isPending }}
      secondaryAction={{ label: "Cancel", onClick: onClose }}
    >
      <Stack gap="sm">
        <Controller
          name="kind"
          control={control}
          render={({ field }) => (
            <SegmentedControl
              aria-label="Deferral type"
              data={[
                { value: "temporary", label: "Temporary" },
                { value: "permanent", label: "Permanent" },
              ]}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
        {kind === "temporary" && (
          <Controller
            name="until"
            control={control}
            render={({ field }) => (
              <DateInput
                label="Deferred until"
                required
                valueFormat="YYYY-MM-DD"
                minDate={new Date(Date.now() + 86_400_000)}
                value={field.value ?? null}
                onChange={(v) => field.onChange(v ?? undefined)}
                error={formState.errors.until?.message}
              />
            )}
          />
        )}
        {kind === "permanent" && (
          <Alert tone="warning">The donor will not be bled again until reinstated.</Alert>
        )}
        <Controller
          name="reason"
          control={control}
          render={({ field }) => (
            <TextArea
              label="Reason"
              required
              value={field.value}
              onChange={(e) => field.onChange(e.currentTarget.value)}
              error={formState.errors.reason?.message}
            />
          )}
        />
      </Stack>
    </Modal>
  );
}

function ReinstateModal({ donor, opened, onClose, onSaved }: Props) {
  const mut = useSetDeferral(donor, onSaved);
  const { control, handleSubmit, formState } = useForm<ReinstateForm>({
    resolver: zodResolver(reinstateSchema),
    defaultValues: { reason: "" },
  });
  const submit = handleSubmit((v) => mut.mutate({ deferred: false, reason: v.reason.trim() }));
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={`Reinstate ${donor.first_name} ${donor.last_name}`}
      primaryAction={{
        label: "Lift deferral",
        onClick: () => void submit(),
        loading: mut.isPending,
      }}
      secondaryAction={{ label: "Cancel", onClick: onClose }}
    >
      <Stack gap="sm">
        <Alert tone="info">
          Deferred{donor.deferral_until ? ` until ${donor.deferral_until}` : " permanently"}:{" "}
          {donor.deferral_reason ?? "no reason recorded"}. A donor deferred for a reactive TTI
          result cannot be reinstated here.
        </Alert>
        <Controller
          name="reason"
          control={control}
          render={({ field }) => (
            <TextArea
              label="Reason for reinstating"
              required
              value={field.value}
              onChange={(e) => field.onChange(e.currentTarget.value)}
              error={formState.errors.reason?.message}
            />
          )}
        />
      </Stack>
    </Modal>
  );
}
