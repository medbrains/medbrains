/**
 * The share of a pre-auth's approval at which the insurance desk is warned
 * that an inpatient's bill is nearing it. Its own endpoint and permission
 * (`billing.preauth_alerts.configure`); hidden, and never fetched, without it.
 * A stored value the check cannot read is shown as a fault, never as 80.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { Group, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P, type PreauthAlertSettings } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Alert, Button, Card, NumberField, toast } from "@/components/ui";
import { billingService } from "@/services/billing.service";

const QUERY_KEY = ["billing-preauth-alert-settings"];

const schema = z.object({
  threshold_percent: z
    .number({ error: "Enter a whole percent from 1 to 100" })
    .int("Enter a whole percent from 1 to 100")
    .min(1, "Enter a whole percent from 1 to 100")
    .max(100, "Enter a whole percent from 1 to 100"),
});
type Form = z.infer<typeof schema>;

/** The form's starting value: the saved share, else the default unless unreadable. */
function initial(s: PreauthAlertSettings | undefined): Form | undefined {
  if (!s) return undefined;
  if (s.invalid) return { threshold_percent: Number.NaN };
  return { threshold_percent: s.threshold_percent ?? s.default_percent };
}

/** The threshold field, its fault and its save, for the billing settings tab. */
export function PreauthAlertThresholdCard() {
  const canConfigure = useHasPermission(P.BILLING.PREAUTH_ALERTS.CONFIGURE);
  const queryClient = useQueryClient();
  const { data, error, isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => billingService.getPreauthAlertSettings(),
    enabled: canConfigure,
  });
  const form = useForm<Form>({ resolver: zodResolver(schema), values: initial(data) });
  const save = useMutation({
    mutationFn: (f: Form) => billingService.updatePreauthAlertSettings(f),
    onSuccess: (saved) => {
      queryClient.setQueryData(QUERY_KEY, saved);
      toast.success("Pre-auth alert threshold saved", { title: "Billing" });
    },
    onError: (err: Error) => toast.error(err.message, { title: "Threshold not saved" }),
  });
  if (!canConfigure) return null;
  return (
    <Card withBorder padding="md">
      <form
        aria-label="Pre-auth alerts"
        noValidate
        onSubmit={form.handleSubmit((f) => save.mutate(f))}
      >
        <Stack gap="sm">
          <Text fw={600}>Pre-auth alerts</Text>
          <Text size="sm" c="dimmed">
            An insured inpatient&apos;s running bill against the pre-auth&apos;s approved amount.
            The insurance desk is warned at this share and again when the bill passes the approval,
            so it can ask for an enhancement in time.
          </Text>
          {error && (
            <Alert tone="danger" title="The saved threshold did not load">
              {error.message}
            </Alert>
          )}
          {data?.invalid && (
            <Alert tone="danger" title="The saved threshold cannot be read">
              Alerts warn at {data.default_percent}% until a share from 1 to 100 is saved here.
            </Alert>
          )}
          <Group align="flex-end">
            <Controller
              control={form.control}
              name="threshold_percent"
              render={({ field, fieldState }) => (
                <NumberField
                  label="Warn at this share of the approval (%)"
                  min={1}
                  max={100}
                  allowDecimal={false}
                  w={240}
                  disabled={isLoading || Boolean(error)}
                  value={Number.isFinite(field.value) ? field.value : ""}
                  onChange={(v) => field.onChange(typeof v === "number" ? v : Number.NaN)}
                  error={fieldState.error?.message}
                />
              )}
            />
            <Button tone="primary" type="submit" loading={save.isPending} disabled={Boolean(error)}>
              Save
            </Button>
          </Group>
        </Stack>
      </form>
    </Card>
  );
}
