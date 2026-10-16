// Mother–baby band match (Code Pink). Scan the baby's band and the mother's
// band before the baby moves; the server refuses a mismatch, alerts security
// and audits every check. This screen only reflects what the server decided.

import { zodResolver } from "@hookform/resolvers/zod";
import { Group, Stack } from "@mantine/core";
import { ApiError } from "@medbrains/api";
import type { SecurityBandMatchResult, VerifySecurityBandMatchRequest } from "@medbrains/types";
import { IconScan } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Alert, Button, Input, Panel, Select } from "@/components/ui";
import { securityService } from "@/services/security.service";

const PURPOSES = [
  { value: "handover", label: "Handover to mother" },
  { value: "nursery_exit", label: "Leaving the nursery" },
  { value: "discharge", label: "Discharge" },
  { value: "feeding", label: "Feeding" },
];

const matchSchema = z.object({
  infant_tag: z.string().trim().min(1, "Scan the baby's band"),
  mother_band: z.string().trim().min(1, "Scan the mother's band (her UHID)"),
  purpose: z.enum(["handover", "nursery_exit", "discharge", "feeding"]),
});
type MatchForm = z.infer<typeof matchSchema>;

const EMPTY: MatchForm = { infant_tag: "", mother_band: "", purpose: "handover" };

/** What to tell the nurse: a refusal (409) and a failure to check are different. */
export function describeMatchError(error: unknown): { title: string; message: string } {
  if (error instanceof ApiError && error.status === 409) {
    return { title: "Bands do not match — do not hand over", message: error.message };
  }
  if (error instanceof ApiError && error.status === 400) {
    return { title: "Cannot verify this baby", message: error.message };
  }
  const detail = error instanceof Error ? error.message : "unknown error";
  return {
    title: "The match could not be checked",
    message: `${detail}. This is not a match — do not hand the baby over until it is checked.`,
  };
}

export function MotherBabyMatchPanel() {
  const qc = useQueryClient();
  const form = useForm<MatchForm>({ resolver: zodResolver(matchSchema), defaultValues: EMPTY });
  const verifyMut = useMutation<SecurityBandMatchResult, Error, VerifySecurityBandMatchRequest>({
    mutationFn: (body) => securityService.verifySecurityBandMatch(body),
    onSuccess: () => form.reset(EMPTY),
    // A mismatch raises a tag alert on the server; show it in the list below.
    onSettled: () => void qc.invalidateQueries({ queryKey: ["sec-tag-alerts"] }),
    onError: () => undefined,
  });
  const failure = verifyMut.isError ? describeMatchError(verifyMut.error) : null;

  return (
    <Panel
      title="Mother–baby band match"
      description="Scan both bands before a baby is handed over, leaves the nursery or is discharged."
    >
      <Stack component="form" onSubmit={form.handleSubmit((values) => verifyMut.mutate(values))}>
        <Group grow align="flex-start">
          <Controller
            control={form.control}
            name="infant_tag"
            render={({ field, fieldState }) => (
              <Input
                label="Baby's band"
                required
                autoComplete="off"
                {...field}
                error={fieldState.error?.message}
              />
            )}
          />
          <Controller
            control={form.control}
            name="mother_band"
            render={({ field, fieldState }) => (
              <Input
                label="Mother's band (UHID)"
                required
                autoComplete="off"
                {...field}
                error={fieldState.error?.message}
              />
            )}
          />
          <Controller
            control={form.control}
            name="purpose"
            render={({ field }) => (
              <Select
                label="Purpose"
                data={PURPOSES}
                value={field.value}
                onChange={(v) => field.onChange(v ?? "handover")}
                allowDeselect={false}
              />
            )}
          />
        </Group>
        <Group>
          <Button
            tone="primary"
            type="submit"
            leftSection={<IconScan size={16} />}
            loading={verifyMut.isPending}
          >
            Verify match
          </Button>
        </Group>
        {verifyMut.isSuccess && (
          <Alert tone="success" title="Bands match">
            This baby belongs to this mother. The check is recorded.
          </Alert>
        )}
        {failure && (
          <Alert tone="danger" title={failure.title}>
            {failure.message}
          </Alert>
        )}
      </Stack>
    </Panel>
  );
}
