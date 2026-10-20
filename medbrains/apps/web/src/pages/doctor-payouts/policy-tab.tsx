import { zodResolver } from "@hookform/resolvers/zod";
import { Group, SimpleGrid, Stack, Text } from "@mantine/core";
import type { DoctorPayoutSettingsView, UpdateDoctorPayoutSettings } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { DataTable } from "@/components";
import { Alert, Button, Card, Checkbox, Input, Select, Switch, toast } from "@/components/ui";
import { doctorPayoutsService } from "@/services/doctor-payouts.service";
import { BASES, BEARERS, errorText } from "./shared";

const KEY = ["doctor-payouts", "settings"];
const num = z.string().regex(/^\d+(\.\d{1,2})?$/, "A number");

export const policySchema = z.object({
  default_basis: z.enum(["billed", "collected", "realised"]),
  default_share_on: z.enum(["gross", "net"]),
  default_discount_bearer: z.enum(["hospital", "doctor", "pro_rata"]),
  default_disallowance_bearer: z.enum(["hospital", "doctor", "pro_rata"]),
  excluded: z.string(),
  tds_section_code: z.string().trim().min(1, "The section"),
  tds_section_label: z.string().trim().min(1, "Describe the section"),
  tds_rate: num,
  tds_no_pan_rate: num,
  tds_threshold: num,
  cash_daily_warn_limit: num,
  referral_tds_section_code: z.string().trim().min(1, "The section"),
  referral_tds_rate: num,
  referral_tds_threshold: num,
});

type PolicyForm = z.infer<typeof policySchema>;

const TEXT: [keyof PolicyForm, string][] = [
  ["excluded", "Never shared (comma-separated categories)"],
  ["tds_section_code", "TDS section"],
  ["tds_section_label", "Section description"],
  ["tds_rate", "TDS rate %"],
  ["tds_no_pan_rate", "Rate without PAN %"],
  ["tds_threshold", "Yearly threshold (Rs)"],
  ["cash_daily_warn_limit", "Warn above cash per doctor per day (Rs)"],
  ["referral_tds_section_code", "Referral TDS section"],
  ["referral_tds_rate", "Referral TDS rate %"],
  ["referral_tds_threshold", "Referral threshold (Rs)"],
];

function DefaultsForm({ view }: { view: DoctorPayoutSettingsView }) {
  const queryClient = useQueryClient();
  const s = view.settings;
  const { control, handleSubmit } = useForm<PolicyForm>({
    resolver: zodResolver(policySchema),
    defaultValues: { ...s, excluded: s.excluded_categories.join(", ") },
  });
  const save = useMutation({
    mutationFn: ({ excluded, ...rest }: PolicyForm) => {
      const body: UpdateDoctorPayoutSettings = {
        ...rest,
        excluded_categories: excluded
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean),
      };
      return doctorPayoutsService.updateDoctorPayoutSettings(body);
    },
    onSuccess: (v) => {
      queryClient.setQueryData(KEY, v);
      toast.success("Agreements that leave a term blank now follow these.", {
        title: "Policy saved",
      });
    },
  });
  const select = (
    name: keyof PolicyForm,
    label: string,
    data: { value: string; label: string }[],
  ) => (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Select
          label={label}
          data={data}
          allowDeselect={false}
          value={field.value}
          onChange={(v) => field.onChange(v ?? field.value)}
        />
      )}
    />
  );
  return (
    <Stack gap="sm" component="form" onSubmit={handleSubmit((v) => save.mutate(v))}>
      <Text fw={600}>Hospital defaults</Text>
      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        {select("default_basis", "Doctors earn", BASES)}
        {select("default_share_on", "Percentage share is on", [
          { value: "gross", label: "Gross" },
          { value: "net", label: "Net of discount" },
        ])}
        {select("default_discount_bearer", "Discount on a fixed fee", BEARERS)}
        {select("default_disallowance_bearer", "Insurer deductions", BEARERS)}
        {TEXT.map(([name, label]) => (
          <Controller
            key={name}
            control={control}
            name={name}
            render={({ field, fieldState }) => (
              <Input label={label} {...field} error={fieldState.error?.message} />
            )}
          />
        ))}
      </SimpleGrid>
      {save.isError && <Alert tone="danger">{errorText(save.error)}</Alert>}
      <Group justify="flex-end">
        <Button type="submit" loading={save.isPending}>
          Save policy
        </Button>
      </Group>
    </Stack>
  );
}

function ReferralSwitch({
  view,
  which,
}: {
  view: DoctorPayoutSettingsView;
  which: "referral" | "referral_individuals";
}) {
  const queryClient = useQueryClient();
  const [accepted, setAccepted] = useState(false);
  const on =
    which === "referral"
      ? view.settings.referral_enabled
      : view.settings.referral_individuals_enabled;
  const text = view.acknowledgements[which];
  const flip = useMutation({
    mutationFn: (enabled: boolean) =>
      doctorPayoutsService.setReferralPayoutSwitch({
        switch: which,
        enabled,
        acknowledgement: enabled ? text : undefined,
      }),
    onSuccess: (v) => {
      queryClient.setQueryData(KEY, v);
      setAccepted(false);
    },
  });
  const blocked = which === "referral_individuals" && !view.settings.referral_enabled;
  return (
    <Card>
      <Stack gap="xs">
        <Switch
          label={
            which === "referral"
              ? "Pay referral commission to partners"
              : "Also pay individual doctors for referrals"
          }
          checked={on}
          disabled={blocked || flip.isPending || (!on && !accepted)}
          onChange={(e) => flip.mutate(e.currentTarget.checked)}
        />
        {!on && (
          <Checkbox
            label={text}
            checked={accepted}
            disabled={blocked}
            onChange={(e) => setAccepted(e.currentTarget.checked)}
          />
        )}
        {flip.isError && <Alert tone="danger">{errorText(flip.error)}</Alert>}
      </Stack>
    </Card>
  );
}

const eventColumns = [
  {
    key: "when",
    label: "When",
    render: (e: DoctorPayoutSettingsView["events"][number]) =>
      new Date(e.created_at).toLocaleString("en-IN"),
  },
  {
    key: "what",
    label: "Switch",
    render: (e: DoctorPayoutSettingsView["events"][number]) =>
      `${e.switch} ${e.enabled ? "on" : "off"}`,
  },
  {
    key: "who",
    label: "By",
    render: (e: DoctorPayoutSettingsView["events"][number]) => e.acted_by_name ?? e.acted_by,
  },
];

/** The hospital's payout policy and the referral switches. */
export function PolicyTab() {
  const settings = useQuery({
    queryKey: KEY,
    queryFn: () => doctorPayoutsService.getDoctorPayoutSettings(),
  });
  if (settings.isError) {
    return (
      <Alert tone="danger" title="The payout policy could not be loaded">
        {errorText(settings.error)}
      </Alert>
    );
  }
  if (!settings.data) return null;
  const view = settings.data;
  return (
    <Stack gap="md">
      <DefaultsForm view={view} />
      <Text fw={600}>Referral commission</Text>
      <Alert tone="warning" title="Off unless you choose otherwise">
        Medical-council rules forbid a doctor taking commission for referrals, and courts have
        refused the hospital's tax deduction for it. Switching it on needs the acknowledgement
        below, and is recorded.
      </Alert>
      <ReferralSwitch view={view} which="referral" />
      <ReferralSwitch view={view} which="referral_individuals" />
      <DataTable
        columns={eventColumns}
        data={view.events}
        rowKey={(e) => e.id}
        emptyTitle="No switch changes recorded"
      />
    </Stack>
  );
}
